from services.provider import LLMProvider


def generate_expression(
    provider: LLMProvider,
    chinese_text: str,
    task_type: str,
) -> dict:
    task_label = (
        "Task 1（学术客观风格，描述图表）"
        if task_type == "task1"
        else "Task 2（议论文，正式但有观点）"
    )

    system = (
        "You are an IELTS Writing Coach. Help Chinese students express ideas in English. "
        "Return ONLY valid JSON. "
        "The 'tip' fields and 'usage_guide' must be written in Simplified Chinese. "
        "The 'en' fields must be in English."
    )

    user = f"""学生想用英文表达：
"{chinese_text}"

语境：IELTS {task_label}

请提供三档英文表达，并以 JSON 返回：
{{
  "low_risk": {{
    "en": "简单、准确、语法稳妥的英文表达（5.5-6.0 水平）",
    "tip": "何时用这个版本（中文，1 句话）"
  }},
  "recommended": {{
    "en": "准确且有一定学术感的英文表达（6.5 水平，大多数情况首选）",
    "tip": "何时用这个版本（中文，1 句话）"
  }},
  "advanced": {{
    "en": "词汇丰富、句式复杂的高分表达（7.0+ 水平，需确认语法无误再用）",
    "tip": "何时用这个版本（中文，1 句话）"
  }},
  "usage_guide": "关于如何在这道题中选择合适版本的整体建议（中文，2 句话以内）"
}}"""

    result = provider.chat_json(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        schema={},
        temperature=0.5,
        max_tokens=1600,
        context="coach.expression",
    )

    for key in ("low_risk", "recommended", "advanced"):
        if key not in result:
            raise ValueError(f"LLM 返回缺少字段 '{key}'，请重试")

    return result
