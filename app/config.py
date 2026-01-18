"""
Application Configuration
Loads settings from environment variables
"""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional


class Settings(BaseSettings):
    # MongoDB
    mongodb_url: str
    database_name: str = "gaming_rental"

    # JWT Authentication
    secret_key: str
    access_token_expire_minutes: int = 1440  # 24 hours
    algorithm: str = "HS256"

    # Business Settings
    hourly_rate: int = 70  # Ghana Cedis
    currency: str = "GHS"
    min_booking_hours: int = 1
    max_booking_hours: int = 6

    # MTN Mobile Money
    momo_number: str = "0592005318"
    momo_name: str = "NANOA GODFRED"

    # Admin - REQUIRED, no weak defaults
    admin_email: str  # Must be set in .env
    admin_password: str  # Must be set in .env

    @field_validator('admin_password')
    @classmethod
    def validate_admin_password(cls, v: str) -> str:
        if len(v) < 12:
            raise ValueError('Admin password must be at least 12 characters')
        if v.lower() in ['admin123456', 'password123', 'adminadmin', '123456789012']:
            raise ValueError('Admin password is too weak. Please use a strong password.')
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


# Global settings instance
settings = Settings()
