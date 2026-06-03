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
        "'original' fields (keep exactly as student wrote), and "
        "'suggestion' fields (must be complete English sentences ready to replace the original). "
        "Be concise and direct — no lengthy explanations."
    )

    user = f"""请诊断以下雅思作文：

题型：{task_label}
问题类型：{question_type or "通用"}
题目：
{prompt or "（未提供）"}

作文内容：
{essay_content}

最低字数：{min_words} 词

返回如下 JSON（严格遵守格式）：
{{
  "estimated_band": "预估分数段，如 6.0 / 6.5 / 7.0+",
  "main_problems": [
    {{
      "category": "雅思评分维度（Task Achievement / Coherence / Vocabulary / Grammar 之一）",
      "issue": "具体问题（中文，1-2 句话）",
      "severity": "high 或 medium"
    }}
  ],
  "top_sentence_fixes": [
    {{
      "original": "原文中的问题句子（原样保留，英文）",
      "problem": "这句话的问题说明（中文，1句话）",
      "suggestion": "改写后的完整英文句子，可直接替换原句（用于展示，不存为资源）",
      "resource_type": "pattern / collocation / expression 三选一",
      "resource_name": "语言技巧名称，聚焦技巧本身，如'让步转折句'、'形容词描述工作状态'（中文，15字内）",
      "resource_goal": "掌握后能做什么，如'用形容词替代动词短语，表达更地道'（中文，20字内）",
      "resource_pattern": "根据resource_type生成不同内容：①pattern类型→抽象句型模板，用[...]标注可替换部分，如'[Subject] are disappearing because [agent] can [do] tasks once handled by [workers].'；②collocation类型→核心词块短语（2-6词），如'career transition'、'work-life balance'；③expression类型→功能性表达（5-15词），如'be driven by financial considerations'、'contribute significantly to'",
      "resource_items": ["基于当前题目的1-2个完整例句，展示resource_pattern的使用方法"]
    }}
  ],
  "phrase_resources": [
    {{
      "pattern": "从作文中提炼的搭配词块或功能短语（英文，2-8词），如'pursue a more fulfilling career'、'financial security'",
      "name": "中文名称（10字内）",
      "goal": "用途说明（中文，15字内）",
      "type": "collocation 或 expression"
    }}
  ],
  "template_misuse": "若发现机械套用模板迹象请说明（中文 1句），否则返回空字符串",
  "next_training_task": "下次练习的具体建议（中文，2句以内，可操作）"
}}

要求：
- main_problems 最多 2 条，挑对分数影响最大的
- top_sentence_fixes 最多 3 条，挑改动后提升最大的句子
- suggestion 必须是完整英文句子，学生可直接替换到作文中
- phrase_resources 提取 3-5 条词块/表达，必须是英文短语（不是整句），覆盖 collocation 和 expression 两种
- 若作文内容为空或不足 30 词，estimated_band 返回 "N/A" 并说明原因"""

    if image_base64:
        # Strip data URL prefix if present (data:image/jpeg;base64,...)
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
        temperature=0.4,
        max_tokens=2200,
    )

    for key in ("estimated_band", "main_problems", "top_sentence_fixes", "next_training_task"):
        if key not in result:
            raise ValueError(f"LLM 返回缺少字段 '{key}'，请重试")

    return result
