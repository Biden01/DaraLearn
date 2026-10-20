from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Student Success OS"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://daralearn:daralearn@localhost:5432/daralearn"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str = ""

    # Заявки с лендинга: уведомление в Telegram (если заданы) и токен для просмотра списка.
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    admin_token: str = ""

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()
