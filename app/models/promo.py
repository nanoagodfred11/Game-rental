"""
Promo Code Model - MongoDB Document
Represents discount codes for marketing campaigns
"""
from datetime import datetime
from typing import Optional, List
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class DiscountType(str, Enum):
    PERCENTAGE = "percentage"  # e.g., 20% off
    FIXED = "fixed"            # e.g., GH₵20 off
    FREE_HOURS = "free_hours"  # e.g., 1 free hour


class PromoCode(Document):
    """Promo code document stored in MongoDB"""
    
    # Code identification
    code: str = Field(..., unique=True)  # e.g., "WELCOME20", "NEWYEAR2026"
    
    # Description
    name: str  # "Welcome Discount"
    description: Optional[str] = None
    
    # Discount details
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: int  # 20 for 20% or GH₵20 or 1 hour
    
    # Constraints
    min_hours: int = 1  # Minimum hours to apply
    max_discount: Optional[int] = None  # Maximum discount amount (for percentage)
    
    # Usage limits
    max_uses: Optional[int] = None  # Total uses allowed (None = unlimited)
    max_uses_per_user: int = 1  # Uses per user
    current_uses: int = 0
    
    # User restrictions
    allowed_emails: List[str] = []  # Empty = all users allowed
    first_booking_only: bool = False  # Only for first-time bookers
    
    # Validity period
    valid_from: datetime = Field(default_factory=datetime.utcnow)
    valid_until: Optional[datetime] = None
    
    # Status
    is_active: bool = True
    
    # Tracking
    used_by: List[str] = []  # List of user_ids who used this code
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    
    class Settings:
        name = "promo_codes"
    
    class Config:
        json_schema_extra = {
            "example": {
                "code": "WELCOME20",
                "name": "Welcome Discount",
                "discount_type": "percentage",
                "discount_value": 20,
                "max_uses": 100,
                "first_booking_only": True
            }
        }


# Pydantic schemas

class PromoCodeCreate(BaseModel):
    """Schema for creating a promo code (admin only)"""
    code: str = Field(..., min_length=3, max_length=20)
    name: str
    description: Optional[str] = None
    discount_type: DiscountType = DiscountType.PERCENTAGE
    discount_value: int = Field(gt=0)
    min_hours: int = Field(1, ge=1)
    max_discount: Optional[int] = None
    max_uses: Optional[int] = None
    max_uses_per_user: int = Field(1, ge=1)
    allowed_emails: List[str] = []
    first_booking_only: bool = False
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None


class PromoCodeResponse(BaseModel):
    """Schema for promo code response"""
    id: str
    code: str
    name: str
    description: Optional[str]
    discount_type: DiscountType
    discount_value: int
    min_hours: int
    max_discount: Optional[int]
    max_uses: Optional[int]
    current_uses: int
    is_active: bool
    valid_from: datetime
    valid_until: Optional[datetime]
    created_at: datetime


class PromoCodeValidate(BaseModel):
    """Schema for validating a promo code"""
    code: str
    hours: int


class PromoCodeApplyResult(BaseModel):
    """Result of applying a promo code"""
    valid: bool
    code: str
    message: str
    discount_amount: int = 0
    original_amount: int = 0
    final_amount: int = 0
    discount_description: str = ""
