from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Student Success OS"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://daralearn:daralearn@localhost:5432/daralearn"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str = ""
    llm_model: str = "claude-opus-5-5"
    tutor_daily_limit: int = 60       # сообщений AI Tutor на ученика в сутки
    check_delay_hours: int = 48       # через сколько после помощи — отложенная проверка

    # Подпись сессионных JWT (обязательно задать в .env на проде)
    jwt_secret: str = "dev-secret-change-me"
    session_days: int = 30

    # Заявки с лендинга: уведомление в Telegram (если заданы) и токен для просмотра списка.
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    admin_token: str = ""
    # email'ы, которые при регистрации сразу получают роль администратора
    admin_emails: list[str] = []

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()
