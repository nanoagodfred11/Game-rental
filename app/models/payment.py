"""
Payment Model - MongoDB Document
Tracks MTN Mobile Money payments
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class PaymentStatus(str, Enum):
    PENDING = "pending"          # Awaiting payment
    PROCESSING = "processing"    # Payment being verified
    COMPLETED = "completed"      # Payment confirmed
    FAILED = "failed"           # Payment failed
    REFUNDED = "refunded"       # Payment refunded


class PaymentType(str, Enum):
    BOOKING = "booking"          # Initial booking payment
    EXTENSION = "extension"      # Payment for extended time


class Payment(Document):
    """Payment document stored in MongoDB"""
    
    # Payment identification
    payment_id: str = Indexed(unique=True)  # e.g., "PAY-20251230-001"
    
    # References
    user_id: str
    user_email: str
    user_phone: str
    booking_id: str
    
    # Payment details
    payment_type: PaymentType = PaymentType.BOOKING
    amount: int  # In Ghana Cedis
    currency: str = "GHS"
    
    # MTN MoMo details
    momo_number_to: str = "0592005318"  # Your MoMo number
    momo_name_to: str = "NANOA GODFRED"
    momo_number_from: Optional[str] = None  # Customer's MoMo number
    momo_transaction_id: Optional[str] = None  # MoMo reference number
    
    # Status
    status: PaymentStatus = PaymentStatus.PENDING
    
    # Verification
    verified_by: Optional[str] = None  # Admin who verified
    verified_at: Optional[datetime] = None
    
    # Notes
    notes: Optional[str] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "payments"
    
    class Config:
        json_schema_extra = {
            "example": {
                "payment_id": "PAY-20251230-001",
                "user_email": "student@university.edu.gh",
                "booking_id": "BK-20251230-001",
                "amount": 400,
                "currency": "GHS",
                "status": "pending"
            }
        }


# Pydantic schemas for API

class PaymentCreate(BaseModel):
    """Internal schema for creating a payment record"""
    booking_id: str
    amount: int
    payment_type: PaymentType = PaymentType.BOOKING


class PaymentResponse(BaseModel):
    """Schema for payment response"""
    id: str
    payment_id: str
    booking_id: str
    payment_type: PaymentType
    amount: int
    currency: str
    momo_number_to: str
    momo_name_to: str
    status: PaymentStatus
    momo_transaction_id: Optional[str]
    created_at: datetime
    verified_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class PaymentConfirm(BaseModel):
    """Schema for customer to submit payment details"""
    momo_number_from: str = Field(min_length=10, max_length=15)
    momo_transaction_id: str = Field(min_length=5, description="MoMo transaction reference")


class PaymentVerify(BaseModel):
    """Schema for admin to verify payment"""
    status: PaymentStatus
    notes: Optional[str] = None


class PaymentInstructions(BaseModel):
    """Payment instructions for customer"""
    payment_id: str
    booking_id: str
    amount: int
    currency: str
    momo_number: str
    momo_name: str
    instructions: list[str]
    important_notes: list[str]
