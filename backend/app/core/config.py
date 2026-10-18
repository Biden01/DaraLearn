from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Student Success OS"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://daralearn:daralearn@localhost:5432/daralearn"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str = ""


settings = Settings()
