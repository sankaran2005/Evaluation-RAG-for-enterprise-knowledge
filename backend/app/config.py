import os
from pathlib import Path
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

class Settings:
    def __init__(self):
        self.APP_NAME: str = os.getenv("APP_NAME", "Evaluating RAG for Enterprise Knowledge")
        self.ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
        self.PORT: int = int(os.getenv("PORT", "8000"))
        self.HOST: str = os.getenv("HOST", "0.0.0.0")
        self.SECRET_KEY: str = os.getenv("SECRET_KEY", "enterprise_rag_evaluator_jwt_secret_2025")
        
        # Storage paths
        self.DATA_DIR: Path = BASE_DIR / "data"
        self.UPLOADS_DIR: Path = BASE_DIR / "data" / "uploads"
        self.VECTOR_DIR: Path = BASE_DIR / "data" / "vector_store"
        self.DB_PATH: Path = BASE_DIR / "data" / "rag_enterprise.db"
        
        # RAG Settings
        self.EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
        self.DEFAULT_TOP_K: int = int(os.getenv("DEFAULT_TOP_K", "4"))
        self.SIMILARITY_THRESHOLD: float = float(os.getenv("SIMILARITY_THRESHOLD", "0.05"))
        self.CHUNK_SIZE: int = int(os.getenv("CHUNK_SIZE", "500"))
        self.CHUNK_OVERLAP: int = int(os.getenv("CHUNK_OVERLAP", "100"))
        
        # LLM Provider
        self.DEFAULT_LLM_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "local")
        self.GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
        self.OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
        self.ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
        self.OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")

    def update(self, **kwargs):
        for k, v in kwargs.items():
            if hasattr(self, k) and v is not None:
                setattr(self, k, v)

settings = Settings()

# Ensure directories exist
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
settings.UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
settings.VECTOR_DIR.mkdir(parents=True, exist_ok=True)
