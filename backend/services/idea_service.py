from services.provider import LLMProvider


def generate_idea(
    provider: LLMProvider,
    task_type: str,
    question_type: str,
    prompt: str,
) -> dict:
    task_label = (
        "Task 1 小作文（描述图表、流程或地图）"
        if task_type == "task1"
        else "Task 2 大作文（议论文）"
    )
    question_label = question_type or "通用"

    system = (
        "You are an IELTS Writing Coach helping Chinese students plan their essays. "
        "Return ONLY valid JSON. Write ALL text fields in Simplified Chinese. "
        "Do NOT write or suggest a complete essay — only provide a thinking framework."
    )

    user = f"""题型：{task_label}
问题类型：{question_label}
题目内容：
{prompt}

请返回如下 JSON（所有文字用中文）：
{{
  "task_breakdown": "对题目要求的简短分析，说明需要写什么（2-3 句话）",
  "stances": [
    {{
      "label": "立场简短标题（10 字以内）",
      "logic_chain": [
        "引言段：如何引入话题并表明立场",
        "主体段 1：论点 + 展开方向",
        "主体段 2：论点 + 展开方向",
        "结尾段：总结方式"
      ]
    }}
  ],
  "usage_note": "考试中使用此框架的 1-2 句简短建议"
}}

提供 2-3 个不同立场。每个 logic_chain 包含 3-5 个步骤。"""

    result = provider.chat_json(
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        schema={},
        temperature=0.7,
        max_tokens=1200,
    )

    if "stances" not in result or "task_breakdown" not in result:
        raise ValueError("LLM 返回格式不符合预期，请重试")

    return result
