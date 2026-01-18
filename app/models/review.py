"""
Review Model - MongoDB Document
Represents customer ratings and reviews after sessions
"""
from datetime import datetime
from typing import Optional
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class Review(Document):
    """Review document stored in MongoDB"""
    
    # Review identification
    review_id: str = Field(..., unique=True)  # e.g., "REV-20260106-001"
    
    # References
    user_id: str
    user_email: str
    user_name: str
    booking_id: str = Indexed()
    equipment_id: str = Indexed()
    equipment_name: str
    
    # Rating (1-5 stars)
    rating: int = Field(ge=1, le=5)
    
    # Review content
    title: Optional[str] = None
    comment: Optional[str] = None
    
    # Categories ratings (optional, 1-5)
    equipment_condition: Optional[int] = Field(None, ge=1, le=5)
    delivery_speed: Optional[int] = Field(None, ge=1, le=5)
    value_for_money: Optional[int] = Field(None, ge=1, le=5)
    
    # Admin response
    admin_response: Optional[str] = None
    responded_at: Optional[datetime] = None
    
    # Visibility
    is_visible: bool = True
    is_featured: bool = False
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "reviews"
    
    class Config:
        json_schema_extra = {
            "example": {
                "review_id": "REV-20260106-001",
                "user_email": "student@university.edu.gh",
                "booking_id": "BK-20260106-001",
                "rating": 5,
                "comment": "Amazing experience! Setup was fast and games were great."
            }
        }


# Pydantic schemas

class ReviewCreate(BaseModel):
    """Schema for creating a review"""
    booking_id: str
    rating: int = Field(ge=1, le=5)
    title: Optional[str] = Field(None, max_length=100)
    comment: Optional[str] = Field(None, max_length=500)
    equipment_condition: Optional[int] = Field(None, ge=1, le=5)
    delivery_speed: Optional[int] = Field(None, ge=1, le=5)
    value_for_money: Optional[int] = Field(None, ge=1, le=5)


class ReviewResponse(BaseModel):
    """Schema for review response"""
    id: str
    review_id: str
    user_name: str
    equipment_name: str
    rating: int
    title: Optional[str]
    comment: Optional[str]
    equipment_condition: Optional[int]
    delivery_speed: Optional[int]
    value_for_money: Optional[int]
    admin_response: Optional[str]
    is_featured: bool
    created_at: datetime


class AdminReviewResponse(BaseModel):
    """Schema for admin responding to a review"""
    response: str = Field(..., max_length=500)
