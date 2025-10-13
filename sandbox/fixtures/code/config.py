# Configuration settings
import os
from typing import Dict, Any


class Config:
    """Base configuration class"""

    DEBUG = False
    TESTING = False
    DATABASE_URI = "sqlite:///app.db"
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")

    @staticmethod
    def init_app(app):
        pass


class DevelopmentConfig(Config):
    """Development configuration"""

    DEBUG = True
    DATABASE_URI = "sqlite:///dev.db"


class ProductionConfig(Config):
    """Production configuration"""

    DATABASE_URI = os.environ.get("DATABASE_URL")

    @staticmethod
    def init_app(app):
        # TODO: Add production logging
        Config.init_app(app)


class TestConfig(Config):
    """Test configuration"""

    TESTING = True
    DATABASE_URI = "sqlite:///:memory:"


config: Dict[str, type[Config]] = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestConfig,
    "default": DevelopmentConfig,
}
