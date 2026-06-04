from pydantic import BaseModel
from typing import Optional


class SettingsRead(BaseModel):
    provider: str
    model_name: str
    base_url: str
    api_key_masked: str  # 只返回末四位，不暴露完整 key
    supports_vision: bool
    supports_json_schema: bool
    supports_tool_calling: bool
    temperature: float
    max_tokens: int


class SettingsWrite(BaseModel):
    provider: Optional[str] = None
    model_name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None  # 前端提交原始 key，后端写入 DB
    supports_vision: Optional[bool] = None
    supports_json_schema: Optional[bool] = None
    supports_tool_calling: Optional[bool] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class FeatureSettingsRead(BaseModel):
    feature: str
    enabled: bool
    model_name: str
    base_url: str
    api_key_masked: str
    temperature: float
    max_tokens: int
    # Effective config after override/fallback resolution (masked key)
    effective_source: str        # 'general' | 'feature'
    effective_model_name: str
    effective_base_url: str
    effective_api_key_masked: str


class FeatureSettingsWrite(BaseModel):
    enabled: Optional[bool] = None
    model_name: Optional[str] = None
    base_url: Optional[str] = None
    api_key: Optional[str] = None
    temperature: Optional[float] = None
    max_tokens: Optional[int] = None


class ProfileStatus(BaseModel):
    is_setup_complete: bool


class ProfileWrite(BaseModel):
    target_band: str
    main_task: str
    main_problem: str
    template_style: str
    allow_profile_update: bool


class ProfileRead(BaseModel):
    target_band: str
    main_task: str
    main_problem: str
    template_style: str
    allow_profile_update: bool
