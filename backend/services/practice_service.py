import json
import re
import uuid
from difflib import SequenceMatcher

from services.provider import LLMProvider


# ── Answer checking ───────────────────────────────────────────────────────────

def check_answer(user_answer: str, correct_answer: str) -> bool:
    u = _normalize(user_answer)
    c = _normalize(correct_answer)
    return bool(u and c and u == c)


def _normalize(s: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"[^\w\s'-]", "", (s or "").strip().lower())).strip()


# ── Local fallback generation ─────────────────────────────────────────────────

_STOP_WORDS = {
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "to", "of", "in", "on", "for", "with", "and", "or", "but", "it", "this",
    "that", "as", "by", "at", "from", "can", "could", "should", "would",
    "will", "may", "might", "do", "does", "did", "not",
}


def _short(text: str, limit: int) -> str:
    text = re.sub(r"\s+", " ", (text or "").strip())
    return text if len(text) <= limit else text[: max(0, limit - 1)] + "…"


def _words(text: str) -> list[str]:
    return re.findall(r"[A-Za-z]+(?:'[A-Za-z]+)?|\d+(?:\.\d+)?", text or "")


def _changed_phrase(original: str, suggestion: str) -> str:
    """Pick the first meaningful changed phrase from a sentence correction."""
    o_words = _words(original)
    s_words = _words(suggestion)
    if not s_words:
        return ""

    matcher = SequenceMatcher(
        None,
        [w.lower() for w in o_words],
        [w.lower() for w in s_words],
    )
    for tag, _i1, _i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        changed = s_words[j1:j2]
        changed = [w for w in changed if w.lower() not in _STOP_WORDS]
        if 1 <= len(changed) <= 6:
            return " ".join(changed)

    # No clean diff: use a non-trivial content word.
    for w in s_words:
        if len(w) >= 5 and w.lower() not in _STOP_WORDS:
            return w
    return s_words[0]


def _changed_pair(original: str, suggestion: str) -> tuple[str, str]:
    """Return (original phrase, improved phrase) for the first useful diff."""
    o_words = _words(original)
    s_words = _words(suggestion)
    if not o_words or not s_words:
        return "", _changed_phrase(original, suggestion)

    matcher = SequenceMatcher(
        None,
        [w.lower() for w in o_words],
        [w.lower() for w in s_words],
    )
    for tag, i1, i2, j1, j2 in matcher.get_opcodes():
        if tag == "equal":
            continue
        old = o_words[i1:i2]
        new = [w for w in s_words[j1:j2] if w.lower() not in _STOP_WORDS]
        if 1 <= len(new) <= 6:
            return " ".join(old), " ".join(new)
    return "", _changed_phrase(original, suggestion)


_VARIANT_MAP: dict[str, list[str]] = {
    "introduce": ["implement", "enforce", "adopt"],
    "implement": ["introduce", "enforce", "adopt"],
    "enforce": ["implement", "introduce"],
    "allocate": ["provide", "assign"],
    "address": ["deal with", "tackle"],
    "reduce": ["decrease", "lower"],
    "job instability": ["employment instability", "job insecurity", "unstable employment"],
    "on a larger scale": ["at a broader level", "on a wider scale"],
}


def _answer_variants(answer: str) -> list[str]:
    answer = re.sub(r"\s+", " ", (answer or "").strip())
    if not answer:
        return []
    variants = [answer]
    lower = answer.lower()
    variants.extend(_VARIANT_MAP.get(lower, []))
    if " " in answer:
        for key, vals in _VARIANT_MAP.items():
            if key in lower:
                variants.extend(vals)
    out: list[str] = []
    seen: set[str] = set()
    for v in variants:
        k = v.lower().strip()
        if k and k not in seen:
            seen.add(k)
            out.append(v)
    return out


def _json_list(value) -> str:
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            value = parsed
        except json.JSONDecodeError:
            value = [p.strip() for p in re.split(r"[/;,，；]", value) if p.strip()]
    if not isinstance(value, list):
        value = []
    cleaned = [str(v).strip() for v in value if str(v).strip()]
    return json.dumps(cleaned, ensure_ascii=False)


def _choose_answer(sentence: str, preferred: str = "") -> str:
    if preferred and re.search(re.escape(preferred), sentence, flags=re.IGNORECASE):
        return preferred
    for phrase in (
        "better placed",
        "on a larger scale",
        "take responsibility",
        "introduce policies",
        "implement policies",
        "enforce regulations",
        "address",
        "allocate",
        "contribute",
        "effective",
    ):
        match = re.search(re.escape(phrase), sentence, flags=re.IGNORECASE)
        if match:
            return sentence[match.start():match.end()]
    for w in _words(sentence):
        if len(w) >= 6 and w.lower() not in _STOP_WORDS:
            return w
    return ""


def _blank_once(sentence: str, answer: str) -> str:
    if not sentence or not answer:
        return ""
    pattern = re.escape(answer)
    display = re.sub(pattern, "___", sentence, count=1, flags=re.IGNORECASE)
    return display if display != sentence else ""


def _dedupe_items(items: list[dict], limit: int) -> list[dict]:
    seen: set[tuple[str, str]] = set()
    out: list[dict] = []
    for item in items:
        key = (item.get("sentence_display", ""), item.get("answer", "").lower())
        if key in seen or not key[0] or not key[1]:
            continue
        seen.add(key)
        out.append(item)
        if len(out) >= limit:
            break
    return out


def _fallback_practice_items(
    mode: str,
    fixes: list[dict],
    resources,
    n_items: int,
) -> list[dict]:
    """Generate usable practice items without LLM JSON.

    This keeps the product usable when a model returns malformed/truncated JSON.
    The items are intentionally simple and sourced from diagnosis/resource data.
    """
    items: list[dict] = []

    if mode == "dictation":
        for fix in fixes:
            sentence = (fix.get("suggestion") or "").strip()
            if not sentence:
                continue
            weak_answer, answer = _changed_pair(fix.get("original", ""), sentence)
            answer = _choose_answer(sentence, answer)
            items.append({
                "category": "dictation",
                "sentence_original": sentence,
                "sentence_display": "___",
                "answer": sentence,
                "acceptable_answers": [sentence],
                "weak_answer": "",
                "hint_zh": _short(fix.get("problem") or fix.get("resource_name") or "改写句", 15),
                "explanation_zh": _short(
                    fix.get("problem")
                    or (f"注意用 {answer} 替换 {weak_answer}" if weak_answer else "")
                    or "注意整句结构和固定搭配",
                    40,
                ),
            })
        for r in resources:
            sentence = (r["pattern"] or "").strip()
            if not sentence or "[" in sentence or len(_words(sentence)) < 5:
                continue
            items.append({
                "category": "dictation",
                "sentence_original": sentence,
                "sentence_display": "___",
                "answer": sentence,
                "acceptable_answers": [sentence],
                "weak_answer": "",
                "hint_zh": _short(r["zh_goal"] or r["name"] or "资源句", 15),
                "explanation_zh": _short(r["zh_goal"] or "注意整句结构和固定搭配", 40),
            })
        return _dedupe_items(items, n_items)

    for fix in fixes:
        sentence = (fix.get("suggestion") or "").strip()
        if not sentence:
            continue
        weak_answer, answer = _changed_pair(fix.get("original", ""), sentence)
        answer = _choose_answer(sentence, answer)
        display = _blank_once(sentence, answer)
        if not display:
            continue
        category = "grammar" if fix.get("resource_type") == "pattern" else "vocabulary"
        items.append({
            "category": category,
            "sentence_original": sentence,
            "sentence_display": display,
            "answer": answer,
            "acceptable_answers": _answer_variants(answer),
            "weak_answer": weak_answer,
            "hint_zh": _short(fix.get("resource_name") or "改写点", 8),
            "explanation_zh": _short(fix.get("problem") or "来自诊断改写句", 40),
        })

    for r in resources:
        sentence = (r["pattern"] or "").strip()
        if not sentence or "[" in sentence or len(_words(sentence)) < 4:
            continue
        answer = _choose_answer(sentence)
        display = _blank_once(sentence, answer)
        if not display:
            continue
        items.append({
            "category": "vocabulary",
            "sentence_original": sentence,
            "sentence_display": display,
            "answer": answer,
            "acceptable_answers": _answer_variants(answer),
            "weak_answer": "",
            "hint_zh": _short(r["name"] or "关键词", 8),
            "explanation_zh": _short(r["zh_goal"] or "练习这个表达的迁移使用", 40),
        })

    return _dedupe_items(items, n_items)


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
        "Keep explanation_zh under 25 Chinese characters so the response stays short. "
        "Output ONLY a single compact JSON object — no thinking, no markdown fences, no commentary before or after."
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
      "acceptable_answers": ["allocate", "provide"],
      "weak_answer": "give",
      "hint_zh": "动词：分配",
      "explanation_zh": "allocate sth to sth 是固定搭配，表示将资源分配给某方面"
    }}
  ]
}}

Rules:
- sentence_display must contain EXACTLY ONE ___
- answer is the recommended word(s) that fill ___
- acceptable_answers lists 2-4 valid alternatives if natural in this sentence, including answer
- weak_answer is the student's original/common/basic expression if it appears in the diagnosis original sentence; otherwise ""
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
      "acceptable_answers": ["The government should allocate more funds to education."],
      "weak_answer": "",
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

    result: dict
    try:
        result = provider.chat_json(
            messages=[
                {'role': 'system', 'content': system},
                {'role': 'user', 'content': user},
            ],
            schema={},
            temperature=0.35,
            # Reasoning models (e.g. deepseek-reasoner) spend a large, hidden
            # token budget on chain-of-thought before emitting the answer, so
            # a small ceiling truncates the JSON. Give generous headroom.
            max_tokens=6000,
            context=f"practice.generate.{mode}",
        )
    except Exception as e:
        fallback_items = _fallback_practice_items(mode, fixes, resources, n_items)
        if not fallback_items:
            raise ValueError(f"练习题生成失败：{e}") from e
        result = {"items": fallback_items}

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
            acceptable = item.get("acceptable_answers")
            if not acceptable:
                acceptable = _answer_variants(item.get("answer", ""))
            conn.execute(
                """INSERT INTO practice_items
                   (item_id, session_id, order_idx, category,
                    sentence_original, sentence_display,
                    answer, acceptable_answers_json, weak_answer,
                    hint_zh, explanation_zh)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    str(uuid.uuid4()),
                    session_id,
                    idx,
                    item.get('category', 'vocabulary'),
                    item.get('sentence_original', ''),
                    item.get('sentence_display', '___'),
                    item.get('answer', ''),
                    _json_list(acceptable),
                    item.get('weak_answer', ''),
                    item.get('hint_zh', ''),
                    item.get('explanation_zh', ''),
                ),
            )

    return {'session_id': session_id, 'total': len(valid), 'mode': mode}


def complete_session(conn, session_id: str, score: int, item_results: list[dict] | None = None) -> None:
    with conn:
        for item in item_results or []:
            item_id = (item.get("item_id") or "").strip()
            if not item_id:
                continue
            conn.execute(
                """UPDATE practice_items
                   SET user_answer = ?, is_correct = ?
                   WHERE item_id = ? AND session_id = ?""",
                (
                    item.get("user_answer", ""),
                    1 if item.get("is_correct") else 0,
                    item_id,
                    session_id,
                ),
            )
        conn.execute(
            """UPDATE practice_sessions
               SET status = 'completed', score = ?, updated_at = datetime('now')
               WHERE session_id = ?""",
            (score, session_id),
        )
