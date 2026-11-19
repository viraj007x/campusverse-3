from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    jwt_secret: str = "campusverse-dev-secret-change-me"
    access_token_expire_minutes: int = 60 * 24 * 7

    database_url: str = f"sqlite:///{(BACKEND_DIR / 'campusverse.db').as_posix()}"
    frontend_origin: str = "http://localhost:3100"

    docs_dir: Path = WORKSPACE_DIR / "data" / "docs"
    uploads_dir: Path = WORKSPACE_DIR / "data" / "uploads"
    models_dir: Path = BACKEND_DIR / "models_data"
    chroma_dir: Path = BACKEND_DIR / "chroma_db"

    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    clip_model: str = "ViT-B-32"
    clip_pretrained: str = "laion2b_s34b_b79k"

    @property
    def llm_mode(self) -> str:
        if self.llm_provider == "groq" and self.groq_api_key:
            return "groq"
        if self.llm_provider == "openai" and self.openai_api_key:
            return "openai"
        return "offline"


settings = Settings()
for _d in (settings.docs_dir, settings.uploads_dir, settings.models_dir, settings.chroma_dir):
    _d.mkdir(parents=True, exist_ok=True)
