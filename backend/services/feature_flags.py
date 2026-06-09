import os

CET6_QUESTION_TYPES = {"cet6_writing", "cet6_translation"}


def _env_enabled(name: str, default: bool = True) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() not in {"0", "false", "no", "off"}


def cet6_enabled() -> bool:
    return _env_enabled("ENABLE_CET6", default=True)


def is_cet6_question_type(question_type: str) -> bool:
    return question_type in CET6_QUESTION_TYPES


def ensure_question_type_enabled(question_type: str) -> None:
    if is_cet6_question_type(question_type) and not cet6_enabled():
        raise ValueError("六级诊断功能当前未开启。")
