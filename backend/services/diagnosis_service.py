import re
from copy import deepcopy
from math import floor
from typing import Any

from services.provider import LLMProvider


TASK_REVIEW = "review"

COMMON_DIMENSIONS = [
    {
        "key": "coherence_cohesion",
        "official_name": "Coherence and Cohesion",
        "label_zh": "结构衔接",
    },
    {
        "key": "lexical_resource",
        "official_name": "Lexical Resource",
        "label_zh": "词汇表达",
    },
    {
        "key": "grammar",
        "official_name": "Grammatical Range and Accuracy",
        "label_zh": "语法准确性",
    },
]

TASK_DIMENSIONS = {
    "task1": [
        {
            "key": "task_achievement",
            "official_name": "Task Achievement",
            "label_zh": "任务完成度",
        },
        *COMMON_DIMENSIONS,
    ],
    "task2": [
        {
            "key": "task_response",
            "official_name": "Task Response",
            "label_zh": "任务回应",
        },
        *COMMON_DIMENSIONS,
    ],
}


def _task_label(task_type: str) -> str:
    if task_type == "task1":
        return "Task 1 小作文（图表 / 流程 / 地图描述）"
    return "Task 2 大作文（议论文）"


def _min_words(task_type: str) -> int:
    return 150 if task_type == "task1" else 250


def split_paragraphs(content: str) -> list[str]:
    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", content or "") if p.strip()]
    if paragraphs:
        return paragraphs
    stripped = (content or "").strip()
    return [stripped] if stripped else []


def split_sentences(paragraph: str) -> list[str]:
    sentences = re.findall(r"[^.!?。！？]+[.!?。！？]?", paragraph.replace("\n", " "))
    cleaned = [s.strip() for s in sentences if s.strip()]
    return cleaned or [paragraph.strip()]


def _empty_result() -> dict:
    return {
        "estimated_band": "N/A",
        "dimension_scores": [],
        "main_problems": [],
        "top_sentence_fixes": [],
        "phrase_resources": [],
        "template_misuse": "",
        "next_training_task": "",
        "diagnosis_scope_note": "",
        "diagnosis_status": "complete",
        "failed_tasks": [],
    }


def _system_prompt() -> str:
    return (
        "You are an expert IELTS examiner and writing coach. "
        "Return valid JSON only. Write Chinese for explanations, but keep original "
        "student text and suggested replacement text in English. Be concise."
    )


def _short_error(exc: Exception) -> str:
    return str(exc)[:500] or exc.__class__.__name__


def _dimension_defs(task_type: str) -> list[dict]:
    return TASK_DIMENSIONS["task1" if task_type == "task1" else "task2"]


def _parse_band_score(value: Any) -> float | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        score = float(value)
    else:
        match = re.search(r"\d+(?:\.\d+)?", str(value))
        if not match:
            return None
        score = float(match.group(0))
    if score < 0 or score > 9:
        return None
    return floor(score * 2 + 0.5) / 2


def _format_band(score: float | None) -> str:
    if score is None:
        return "N/A"
    return f"{score:.1f}"


def _normalize_dimension_scores(raw_scores: Any, task_type: str) -> list[dict]:
    definitions = _dimension_defs(task_type)
    if isinstance(raw_scores, dict):
        raw_items = [
            {**value, "key": value.get("key", key)}
            if isinstance(value, dict)
            else {"key": key, "score": value}
            for key, value in raw_scores.items()
        ]
    elif isinstance(raw_scores, list):
        raw_items = [item for item in raw_scores if isinstance(item, dict)]
    else:
        raw_items = []

    def matches(item: dict, definition: dict) -> bool:
        values = {
            str(item.get("key") or "").strip().lower(),
            str(item.get("official_name") or "").strip().lower(),
            str(item.get("criterion") or "").strip().lower(),
            str(item.get("label_zh") or item.get("label") or "").strip().lower(),
        }
        return bool({
            definition["key"].lower(),
            definition["official_name"].lower(),
            definition["label_zh"].lower(),
        } & values)

    normalized: list[dict] = []
    for definition in definitions:
        source = next((item for item in raw_items if matches(item, definition)), {})
        score_value = source.get("score") if "score" in source else source.get("band")
        score = _parse_band_score(score_value)
        normalized.append({
            **definition,
            "score": score,
            "band": _format_band(score),
            "reason_zh": str(
                source.get("reason_zh")
                or source.get("reason")
                or source.get("explanation")
                or ""
            ).strip(),
        })
    return normalized


def _aggregate_dimension_band(dimension_scores: list[dict]) -> str:
    scores = [
        item["score"]
        for item in dimension_scores
        if isinstance(item.get("score"), (int, float))
    ]
    if len(scores) < 4:
        return "N/A"
    return _format_band(floor((sum(scores) / len(scores)) * 2 + 0.5) / 2)


def _normalize_problem(problem: dict) -> dict:
    return {
        "category": str(problem.get("category") or "Coherence").strip(),
        "issue": str(problem.get("issue") or "").strip(),
        "severity": str(problem.get("severity") or "medium").strip(),
    }


def _normalize_fix(fix: dict, paragraph_index: int) -> dict:
    category = str(fix.get("category") or "expression").strip()
    if category not in ("spelling", "grammar", "expression", "logic"):
        category = "expression"

    scope = str(fix.get("scope") or "sentence").strip()
    if scope not in ("word", "sentence", "paragraph"):
        scope = "sentence"

    sentence_index = fix.get("sentence_index", 0)
    try:
        sentence_index = int(sentence_index)
    except (TypeError, ValueError):
        sentence_index = -1 if scope == "paragraph" else 0

    resource_type = str(fix.get("resource_type") or "expression").strip()
    if resource_type not in ("pattern", "collocation", "expression"):
        resource_type = "expression"

    items = fix.get("resource_items") or []
    if isinstance(items, str):
        items = [items]
    if not isinstance(items, list):
        items = []

    return {
        "scope": scope,
        "category": category,
        "paragraph_index": paragraph_index,
        "sentence_index": sentence_index,
        "original": str(fix.get("original") or "").strip(),
        "problem": str(fix.get("problem") or "").strip(),
        "suggestion": str(fix.get("suggestion") or "").strip(),
        "resource_type": resource_type,
        "resource_name": str(fix.get("resource_name") or "诊断推荐表达").strip(),
        "resource_goal": str(fix.get("resource_goal") or fix.get("problem") or "").strip(),
        "resource_pattern": str(fix.get("resource_pattern") or fix.get("suggestion") or "").strip(),
        "resource_items": [str(item).strip() for item in items if str(item).strip()],
    }


def _normalize_phrase(resource: dict) -> dict:
    resource_type = str(resource.get("type") or "collocation").strip()
    if resource_type not in ("collocation", "expression"):
        resource_type = "expression"
    return {
        "pattern": str(resource.get("pattern") or "").strip(),
        "name": str(resource.get("name") or "短语积累").strip(),
        "goal": str(resource.get("goal") or "").strip(),
        "type": resource_type,
    }


def _dedupe_resources(resources: list[dict]) -> list[dict]:
    seen: set[str] = set()
    deduped: list[dict] = []
    for resource in resources:
        pattern = str(resource.get("pattern") or "").strip()
        key = pattern.lower()
        if not pattern or key in seen:
            continue
        seen.add(key)
        deduped.append(resource)
    return deduped


def _run_review_task(
    provider: LLMProvider,
    *,
    essay_content: str,
    prompt: str,
    task_type: str,
    question_type: str,
    image_base64: str | None,
) -> dict:
    dimension_json = ",\n    ".join(
        (
            f'{{"key": "{item["key"]}", "label_zh": "{item["label_zh"]}", '
            f'"official_name": "{item["official_name"]}", "score": "如 6.0 / 6.5 / 7.0", '
            f'"reason_zh": "中文，1句话，说明该维度为什么是这个分数"}}'
        )
        for item in _dimension_defs(task_type)
    )
    user = f"""请只完成“审题与总体诊断”，输出要短，避免长篇改写。

题型：{_task_label(task_type)}
问题类型：{question_type or "通用"}
最低字数：{_min_words(task_type)} 词
题目：{prompt or "（未提供）"}

作文全文：
{essay_content}

返回 JSON：
{{
  "dimension_scores": [
    {dimension_json}
  ],
  "main_problems": [
    {{
      "category": "任务回应/完成度 / 结构衔接 / 词汇表达 / 语法准确性 之一",
      "issue": "中文，1句话",
      "severity": "high 或 medium"
    }}
  ],
  "template_misuse": "中文，若无则空字符串",
  "next_training_task": "中文，2句以内"
}}

要求：
- 不要逐句改写。
- 必须分别给四个维度分数，score 只能是 0-9 之间的整数或 0.5 分档。
- 不要直接生成总分；总分由系统按四个维度平均后计算。
- main_problems 最多 3 条。
- 重点判断是否审题准确、立场是否回应题目、是否有模板套用。
"""
    if image_base64:
        b64 = image_base64.split(",", 1)[-1]
        user_content: str | list = [
            {"type": "text", "text": user},
            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64}"}},
        ]
    else:
        user_content = user

    result = provider.chat_json(
        messages=[
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": user_content},
        ],
        schema={},
        temperature=0.25,
        max_tokens=2400,
        context="diagnosis.review",
    )
    dimension_scores = _normalize_dimension_scores(result.get("dimension_scores"), task_type)
    estimated_band = _aggregate_dimension_band(dimension_scores)
    if estimated_band == "N/A":
        estimated_band = str(result.get("estimated_band") or "N/A").strip()
    return {
        "estimated_band": estimated_band,
        "dimension_scores": dimension_scores,
        "main_problems": [_normalize_problem(p) for p in result.get("main_problems", [])][:3],
        "template_misuse": str(result.get("template_misuse") or "").strip(),
        "next_training_task": str(result.get("next_training_task") or "").strip(),
        "diagnosis_scope_note": "",
    }


def _run_paragraph_task(
    provider: LLMProvider,
    *,
    paragraph: str,
    paragraph_index: int,
    sentences: list[str],
    prompt: str,
    task_type: str,
    question_type: str,
) -> dict:
    indexed_sentences = "\n".join(
        f"S{idx}: {sentence}" for idx, sentence in enumerate(sentences)
    )
    user = f"""请只诊断下面这一段，不要输出全文诊断。重点检查逻辑、语法、拼写和表达。

题型：{_task_label(task_type)}
问题类型：{question_type or "通用"}
题目：{prompt or "（未提供）"}
段落编号：P{paragraph_index}

段落原文：
{paragraph}

句子索引：
{indexed_sentences}

返回 JSON：
{{
  "fixes": [
    {{
      "scope": "word / sentence / paragraph 之一",
      "category": "spelling / grammar / expression / logic 之一",
      "sentence_index": 0,
      "original": "原文中的对应单词、句子或段落片段，必须原样摘取",
      "problem": "中文，说明为什么改；逻辑类说明跳脱、支撑不足或衔接问题",
      "suggestion": "修改后的英文内容，可直接替换对应片段",
      "resource_type": "pattern / collocation / expression 之一",
      "resource_name": "中文，15字内",
      "resource_goal": "中文，20字内",
      "resource_pattern": "可积累的英文句型、搭配或表达",
      "resource_items": ["英文例句，最多2条"]
    }}
  ],
  "phrase_resources": [
    {{
      "pattern": "英文短语或功能表达，2-12词",
      "name": "中文名称，10字内",
      "goal": "中文用途，15字内",
      "type": "collocation 或 expression"
    }}
  ]
}}

要求：
- fixes 返回 1-4 条，优先真实影响分数的问题；没有问题可返回空数组。
- 段落级逻辑问题 scope 用 paragraph，sentence_index 用 -1。
- 拼写错误用 category=spelling；语法错误用 grammar；表达替换用 expression；论证/衔接/支撑问题用 logic。
- suggestion 不要超过原问题所需范围，避免改写整篇。
- phrase_resources 返回 0-2 条。
"""
    result = provider.chat_json(
        messages=[
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": user},
        ],
        schema={},
        temperature=0.3,
        max_tokens=3600,
        context=f"diagnosis.paragraph.{paragraph_index}",
    )
    return {
        "fixes": [
            _normalize_fix(fix, paragraph_index)
            for fix in result.get("fixes", [])
            if str(fix.get("original") or "").strip() and str(fix.get("suggestion") or "").strip()
        ][:4],
        "phrase_resources": [
            _normalize_phrase(resource)
            for resource in result.get("phrase_resources", [])
            if str(resource.get("pattern") or "").strip()
        ][:2],
    }


def _all_task_keys(paragraph_count: int) -> list[str]:
    return [TASK_REVIEW] + [f"paragraph:{idx}" for idx in range(paragraph_count)]


def _failed_task(key: str, label: str, exc: Exception) -> dict:
    return {"key": key, "label": label, "error": _short_error(exc)}


def _merge_failed_tasks(previous: list[dict], retried_keys: set[str], current: list[dict]) -> list[dict]:
    retained = [task for task in previous if task.get("key") not in retried_keys]
    by_key = {task.get("key"): task for task in retained if task.get("key")}
    for task in current:
        if task.get("key"):
            by_key[task["key"]] = task
    return list(by_key.values())


def run_diagnosis(
    provider: LLMProvider,
    essay_content: str,
    prompt: str,
    task_type: str,
    question_type: str,
    image_base64: str | None = None,
    *,
    retry_task_keys: list[str] | None = None,
    previous_result: dict[str, Any] | None = None,
) -> dict:
    paragraphs = split_paragraphs(essay_content)
    all_keys = _all_task_keys(len(paragraphs))
    requested_keys = set(retry_task_keys or all_keys)
    requested_keys = {key for key in requested_keys if key in all_keys}
    if not requested_keys:
        requested_keys = set(all_keys)

    result = deepcopy(previous_result) if previous_result else _empty_result()
    result.setdefault("main_problems", [])
    result.setdefault("dimension_scores", [])
    result.setdefault("top_sentence_fixes", [])
    result.setdefault("phrase_resources", [])
    result.setdefault("template_misuse", "")
    result.setdefault("next_training_task", "")
    result.setdefault("estimated_band", "N/A")
    result.setdefault("diagnosis_scope_note", "")

    previous_failed = result.get("failed_tasks") or []
    current_failed: list[dict] = []

    if TASK_REVIEW in requested_keys:
        try:
            review = _run_review_task(
                provider,
                essay_content=essay_content,
                prompt=prompt,
                task_type=task_type,
                question_type=question_type,
                image_base64=image_base64,
            )
            result.update(review)
        except Exception as exc:
            current_failed.append(_failed_task(TASK_REVIEW, "审题与总体诊断", exc))

    existing_fixes = result.get("top_sentence_fixes") or []
    existing_resources = result.get("phrase_resources") or []
    retried_paragraphs = {
        int(key.split(":", 1)[1])
        for key in requested_keys
        if key.startswith("paragraph:") and key.split(":", 1)[1].isdigit()
    }
    if retried_paragraphs:
        existing_fixes = [
            fix for fix in existing_fixes
            if fix.get("paragraph_index") not in retried_paragraphs
        ]

    for paragraph_index, paragraph in enumerate(paragraphs):
        key = f"paragraph:{paragraph_index}"
        if key not in requested_keys:
            continue
        try:
            paragraph_result = _run_paragraph_task(
                provider,
                paragraph=paragraph,
                paragraph_index=paragraph_index,
                sentences=split_sentences(paragraph),
                prompt=prompt,
                task_type=task_type,
                question_type=question_type,
            )
            existing_fixes.extend(paragraph_result["fixes"])
            existing_resources.extend(paragraph_result["phrase_resources"])
        except Exception as exc:
            current_failed.append(_failed_task(key, f"第 {paragraph_index + 1} 段诊断", exc))

    result["top_sentence_fixes"] = existing_fixes
    result["phrase_resources"] = _dedupe_resources(existing_resources)
    result["failed_tasks"] = _merge_failed_tasks(previous_failed, requested_keys, current_failed)
    result["diagnosis_status"] = "complete" if not result["failed_tasks"] else "partial_failed"

    if not result["next_training_task"] and result["failed_tasks"]:
        result["next_training_task"] = "部分诊断任务失败，请先点击重试，再根据成功返回的修改点练习。"

    return result
