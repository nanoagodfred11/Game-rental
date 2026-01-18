"""
User Model - MongoDB Document
Represents customers and admin users
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, EmailStr, Field


class UserRole(str, Enum):
    CUSTOMER = "customer"
    ADMIN = "admin"


class User(Document):
    """User document stored in MongoDB"""
    
    # Basic Info
    email: EmailStr = Field(..., unique=True)
    hashed_password: str
    full_name: str
    phone_number: str  # For MoMo and contact
    
    # Location (for delivery)
    hostel_name: str
    room_number: str
    
    # Role
    role: UserRole = UserRole.CUSTOMER
    
    # Account status
    is_active: bool = True
    is_verified: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "users"  # MongoDB collection name
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "student@university.edu.gh",
                "full_name": "Kwame Mensah",
                "phone_number": "0551234567",
                "hostel_name": "Unity Hall",
                "room_number": "B-205",
                "role": "customer"
            }
        }


# Pydantic schemas for API requests/responses

class UserCreate(BaseModel):
    """Schema for user registration"""
    email: EmailStr
    password: str = Field(min_length=6)
    full_name: str = Field(min_length=2)
    phone_number: str = Field(min_length=10, max_length=15)
    hostel_name: str
    room_number: str


class UserLogin(BaseModel):
    """Schema for user login"""
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    """Schema for user response (excludes password)"""
    id: str
    email: str
    full_name: str
    phone_number: str
    hostel_name: str
    room_number: str
    role: UserRole
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    """Schema for updating user profile"""
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    hostel_name: Optional[str] = None
    room_number: Optional[str] = None


class Token(BaseModel):
    """JWT Token response"""
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
