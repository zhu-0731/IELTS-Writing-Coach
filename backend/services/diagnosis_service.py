from services.provider import LLMProvider


def run_diagnosis(
    provider: LLMProvider,
    essay_content: str,
    prompt: str,
    task_type: str,
    question_type: str,
    image_base64: str | None = None,
) -> dict:
    task_label = (
        "Task 1 小作文（图表 / 流程 / 地图描述）"
        if task_type == "task1"
        else "Task 2 大作文（议论文）"
    )
    min_words = 150 if task_type == "task1" else 250

    system = (
        "You are an expert IELTS examiner and writing coach. "
        "Analyze the student's essay and return structured feedback as valid JSON only. "
        "Write ALL text in Simplified Chinese, EXCEPT: "
        "'estimated_band' (format: '6.0' / '6.5' / '7.0+'), "
        "'original' fields (keep exactly as student wrote), "
        "'suggestion' fields (complete English replacement text), and "
        "resource pattern/items fields that are English learning material. "
        "Be concise and direct."
    )

    user = f"""请诊断以下雅思作文，并按文章结构逐句、逐段给出修改建议。

题型：{task_label}
问题类型：{question_type or "通用"}
题目：{prompt or "（未提供）"}

作文内容：
{essay_content}

最低字数：{min_words} 词

返回如下 JSON（严格遵守字段名和 JSON 格式）：
{{
  "estimated_band": "预估分数段，如 6.0 / 6.5 / 7.0+",
  "main_problems": [
    {{
      "category": "Task Achievement / Coherence / Vocabulary / Grammar 之一",
      "issue": "具体问题（中文，1-2句话）",
      "severity": "high 或 medium"
    }}
  ],
  "top_sentence_fixes": [
    {{
      "scope": "word / sentence / paragraph 之一",
      "category": "spelling / grammar / expression / logic 之一",
      "paragraph_index": 0,
      "sentence_index": 0,
      "original": "原文中的对应单词、句子或段落片段（原样保留英文）",
      "problem": "为什么要改（中文，1句话；逻辑类要说明是否跳脱、支撑不足或衔接不清）",
      "suggestion": "修改后的对应英文内容；scope为sentence时给完整句子，scope为paragraph时给可替换段落片段",
      "resource_type": "pattern / collocation / expression 之一",
      "resource_name": "推荐积累名称（中文，15字内）",
      "resource_goal": "掌握后能解决什么问题（中文，20字内）",
      "resource_pattern": "可积累的抽象句型、搭配或表达；不要直接存整篇改写",
      "resource_items": ["基于当前题目的1-2个英文例句"]
    }}
  ],
  "phrase_resources": [
    {{
      "pattern": "推荐积累的英文短语或功能表达（2-12词）",
      "name": "中文名称（10字内）",
      "goal": "用途说明（中文，15字内）",
      "type": "collocation 或 expression"
    }}
  ],
  "template_misuse": "如果发现机械套模板，请中文说明；否则返回空字符串",
  "next_training_task": "下次练习的具体建议（中文，2句以内，可操作）"
}}

要求：
- main_problems 最多 3 条，优先指出对分数影响最大的。
- top_sentence_fixes 不再只挑 3 句；请覆盖全文，返回 8-14 条。短文可以少于 8 条，但要尽量覆盖所有关键句和至少 1 个段落级逻辑问题。
- category 必须覆盖 spelling、grammar、expression、logic 中实际存在的问题；没有拼写问题时可以不返回 spelling。
- paragraph_index 和 sentence_index 从 0 开始；段落级建议 sentence_index 填 -1。
- original 必须能在作文原文中找到或是原文的连续片段，方便前端连线定位。
- suggestion 必须是学生可直接替换到作文中的英文内容。
- phrase_resources 提取 4-8 条系统推荐积累，必须是英文短语或功能表达，不是整句。
- 积累只作为系统推荐返回，不要声称已经自动保存。
- 如果作文内容为空或不足 30 词，estimated_band 返回 "N/A" 并说明原因。
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
            {"role": "system", "content": system},
            {"role": "user", "content": user_content},
        ],
        schema={},
        temperature=0.35,
        max_tokens=4200,
    )

    for key in ("estimated_band", "main_problems", "top_sentence_fixes", "next_training_task"):
        if key not in result:
            raise ValueError(f"LLM 返回缺少字段 '{key}'，请重试")

    return result
