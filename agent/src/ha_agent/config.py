from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=None, extra="ignore")

    google_api_key: str = Field(..., alias="GOOGLE_API_KEY")
    supervisor_token: str = Field(..., alias="SUPERVISOR_TOKEN")
    model: str = "gemini-flash-latest"
    language: str = "nl"
    log_level: str = "info"
    rate_limit_per_min: int = 20
    session_idle_minutes: int = 30
    embedding_model: str = "sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2"
    adults: list[str] = ["edwin", "ilona"]
    ha_url: str = "http://supervisor/core"
    ha_ws_url: str = "ws://supervisor/core/websocket"
    data_dir: str = "/data"
    ui_dist_dir: str = "ui/dist"  # relative to uvicorn cwd; absolute in Docker
