from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Student Success OS"
    environment: str = "development"
    database_url: str = "postgresql+psycopg://daralearn:daralearn@localhost:5432/daralearn"
    cors_origins: list[str] = ["http://localhost:5173"]
    llm_api_key: str = ""
    # нет надёжного дефолта — модели OpenAI меняются быстро, задавать явно в .env
    llm_model: str = ""
    tutor_daily_limit: int = 60       # сообщений AI Tutor на ученика в сутки
    check_delay_hours: int = 48       # через сколько после помощи — отложенная проверка

    # Подпись сессионных JWT (обязательно задать в .env на проде)
    jwt_secret: str = "dev-secret-change-me"
    session_days: int = 30

    # Токен для просмотра заявок с лендинга (GET /api/leads)
    admin_token: str = ""
    # email'ы, которые при регистрации сразу получают роль администратора
    admin_emails: list[str] = []

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"


settings = Settings()
