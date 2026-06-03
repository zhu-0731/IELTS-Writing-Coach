import json
import re
import uuid

from services.provider import LLMProvider


# ── Answer checking ───────────────────────────────────────────────────────────

def check_answer(user_answer: str, correct_answer: str) -> bool:
    u = _normalize(user_answer)
    c = _normalize(correct_answer)
    if u == c:
        return True
    # Allow minor punctuation difference
    u2 = re.sub(r"[^\w\s'-]", '', u).strip()
    c2 = re.sub(r"[^\w\s'-]", '', c).strip()
    if u2 == c2:
        return True
    # Levenshtein ≤ 1 for single words longer than 3 chars (spelling tolerance)
    if ' ' not in c2 and ' ' not in u2 and len(c2) > 3:
        return _levenshtein(u2, c2) <= 1
    return False


def _normalize(s: str) -> str:
    return s.strip().lower().rstrip('.')


def _levenshtein(a: str, b: str) -> int:
    if len(a) < len(b):
        a, b = b, a
    if not b:
        return len(a)
    row = list(range(len(b) + 1))
    for ch in a:
        new_row = [row[0] + 1]
        for j, dch in enumerate(b):
            new_row.append(min(new_row[-1] + 1, row[j + 1] + 1, row[j] + (ch != dch)))
        row = new_row
    return row[-1]


# ── LLM generation ────────────────────────────────────────────────────────────

def generate_practice(
    provider: LLMProvider,
    conn,
    essay_id: str,
    mode: str = 'cloze',
) -> dict:
    essay = conn.execute(
        "SELECT task_type, prompt, content FROM essays WHERE essay_id = ?",
        (essay_id,),
    ).fetchone()
    if not essay:
        raise ValueError("Essay not found")

    diag = conn.execute(
        """SELECT top_sentence_fixes_json FROM diagnoses
           WHERE essay_id = ? ORDER BY created_at DESC LIMIT 1""",
        (essay_id,),
    ).fetchone()
    fixes = json.loads(diag['top_sentence_fixes_json']) if diag else []

    # Phrase-level resources from this essay
    resources = conn.execute(
        """SELECT pattern, name, zh_goal FROM language_resources
           WHERE source_essay_id = ? LIMIT 12""",
        (essay_id,),
    ).fetchall()

    # Build context strings
    fixes_text = '\n'.join(
        f"  原句: {f.get('original', '')}\n  改写: {f.get('suggestion', '')}\n  问题: {f.get('problem', '')}"
        for f in fixes[:3]
    ) or '（无）'

    vocab_text = '\n'.join(
        f"  {r['pattern']}  →  {r['name']}：{r['zh_goal']}"
        for r in resources[:10]
    ) or '（无）'

    essay_snippet = (essay['content'] or '')[:1500]

    n_items = 6 if mode == 'cloze' else 5

    system = (
        "You are an IELTS writing coach creating fill-in-the-blank exercises from a student's essay. "
        "Generate concise, targeted practice items. "
        "Each item tests ONE blank (marked as ___) of 1–6 words. "
        "Return valid JSON only — no extra text or markdown."
    )

    if mode == 'cloze':
        user = f"""Generate {n_items} fill-in-the-blank practice items for this IELTS essay.

=== Grammar/spelling errors from diagnosis (create ~half your items from these) ===
{fixes_text}

=== Key vocabulary extracted from the essay (create ~half your items from these) ===
{vocab_text}

=== Essay content (for extra context) ===
{essay_snippet}

Return exactly this JSON shape:
{{
  "items": [
    {{
      "category": "grammar",
      "sentence_original": "The government should allocate more funds to education.",
      "sentence_display": "The government should ___ more funds to education.",
      "answer": "allocate",
      "hint_zh": "动词：分配",
      "explanation_zh": "allocate sth to sth 是固定搭配，表示将资源分配给某方面"
    }}
  ]
}}

Rules:
- sentence_display must contain EXACTLY ONE ___
- answer is the exact word(s) that fill ___
- hint_zh ≤ 8 chars, gives a type/semantic clue — NOT the answer itself
- explanation_zh is one short Chinese sentence explaining why
- For grammar items: blank the corrected word/phrase (use the suggestion sentence)
- For vocabulary items: blank the key academic phrase
- Avoid blanking trivial words (a, the, is, was)"""
    else:
        user = f"""Generate {n_items} dictation items from corrected sentences.

=== Grammar corrections ===
{fixes_text}

=== Essay content ===
{essay_snippet}

Return JSON:
{{
  "items": [
    {{
      "category": "dictation",
      "sentence_original": "The government should allocate more funds to education.",
      "sentence_display": "___",
      "answer": "The government should allocate more funds to education.",
      "hint_zh": "政府应增加教育资金",
      "explanation_zh": "注意主语后用should+动词原形，allocate...to表示分配"
    }}
  ]
}}

Rules:
- sentence_display is always just "___"
- answer equals sentence_original exactly
- hint_zh ≤ 15 chars — Chinese meaning of the sentence
- explanation_zh: key grammar points to remember"""

    try:
        result = provider.chat_json(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            schema={},
            temperature=0.35,
            max_tokens=2600,
        )
    except Exception as e:
        raise ValueError(f"练习题生成失败：{e}") from e

    items_data = result.get('items', [])
    if not items_data:
        raise ValueError('模型未能生成练习题，请重试')

    # Validate: each item must have ___ in display (for cloze) or be "___" (dictation)
    valid = []
    for item in items_data:
        display = item.get('sentence_display', '')
        answer = item.get('answer', '').strip()
        if not answer:
            continue
        if mode == 'cloze' and '___' not in display:
            continue
        valid.append(item)

    if not valid:
        raise ValueError('模型生成的练习题格式不合格，请重试')

    # Persist
    session_id = str(uuid.uuid4())
    with conn:
        conn.execute(
            """INSERT INTO practice_sessions (session_id, essay_id, mode, status, total)
               VALUES (?, ?, ?, 'in_progress', ?)""",
            (session_id, essay_id, mode, len(valid)),
        )
        for idx, item in enumerate(valid):
            conn.execute(
                """INSERT INTO practice_items
                   (item_id, session_id, order_idx, category,
                    sentence_original, sentence_display,
                    answer, hint_zh, explanation_zh)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    session_id,
                    idx,
                    item.get('category', 'vocabulary'),
                    item.get('sentence_original', ''),
                    item.get('sentence_display', '___'),
                    item.get('answer', ''),
                    item.get('hint_zh', ''),
                    item.get('explanation_zh', ''),
                ),
            )

    return {'session_id': session_id, 'total': len(valid), 'mode': mode}


def complete_session(conn, session_id: str, score: int) -> None:
    with conn:
        conn.execute(
            """UPDATE practice_sessions
               SET status = 'completed', score = ?, updated_at = datetime('now')
               WHERE session_id = ?""",
            (score, session_id),
        )
