"""
Booking Model - MongoDB Document
Represents gaming equipment rental reservations
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class BookingStatus(str, Enum):
    PENDING = "pending"              # Booking created, awaiting payment
    PAYMENT_RECEIVED = "payment_received"  # Payment confirmed
    CONFIRMED = "confirmed"          # Ready for delivery
    DELIVERED = "delivered"          # Equipment delivered, awaiting user photo
    AWAITING_CONFIRMATION = "awaiting_confirmation"  # User uploaded photo, waiting for admin to confirm
    IN_USE = "in_use"               # Admin confirmed, customer is playing
    EXTENDED = "extended"            # Customer extended their session
    COMPLETED = "completed"          # Session ended, equipment returned
    CANCELLED = "cancelled"          # Booking cancelled
    REFUNDED = "refunded"           # Cancelled and refunded


class Booking(Document):
    """Booking document stored in MongoDB"""
    
    # Booking ID for easy reference
    booking_id: str = Field(..., unique=True)  # e.g., "BK-20251230-001"
    
    # References
    user_id: str
    user_email: str
    user_phone: str
    equipment_id: str
    equipment_name: str
    
    # Delivery location
    hostel_name: str
    room_number: str
    
    # Time slots
    booking_date: datetime  # The date of booking
    start_time: datetime    # When session starts
    end_time: datetime      # When session ends
    hours_booked: int       # Number of hours
    
    # Extension tracking
    original_end_time: Optional[datetime] = None  # Original end time before extension
    extension_hours: int = 0
    total_hours: int = 0  # hours_booked + extension_hours
    
    # Pending extension (not yet paid)
    pending_extension_hours: int = 0
    pending_extension_amount: int = 0
    pending_extension_payment_id: Optional[str] = None
    
    # Pricing (in Ghana Cedis)
    hourly_rate: int = 70
    base_amount: int = 0      # hours_booked * hourly_rate
    extension_amount: int = 0  # extension_hours * hourly_rate
    total_amount: int = 0     # base_amount + extension_amount
    
    # Promo code discount
    promo_code_used: Optional[str] = None
    discount_amount: int = 0
    
    # Status
    status: BookingStatus = BookingStatus.PENDING
    
    # Payment tracking
    is_paid: bool = False
    payment_id: Optional[str] = None
    extension_payment_id: Optional[str] = None
    
    # Admin notes
    admin_notes: Optional[str] = None
    
    # Delivery confirmation
    delivery_photo_url: Optional[str] = None  # Photo of setup uploaded by user
    delivery_confirmed_at: Optional[datetime] = None  # When user confirmed delivery
    actual_start_time: Optional[datetime] = None  # Actual start time (after delivery confirmation)
    actual_end_time: Optional[datetime] = None  # Actual end time (calculated from actual_start_time)
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    delivered_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    
    # Notifications
    user_notified_payment: bool = False  # User notified of payment confirmation
    user_notified_delivery: bool = False  # User notified equipment is on the way
    
    class Settings:
        name = "bookings"
    
    class Config:
        json_schema_extra = {
            "example": {
                "booking_id": "BK-20251230-001",
                "user_email": "student@university.edu.gh",
                "equipment_name": "PS5 Set 1",
                "hostel_name": "Unity Hall",
                "room_number": "B-205",
                "start_time": "2025-12-30T14:00:00",
                "end_time": "2025-12-30T18:00:00",
                "hours_booked": 4,
                "total_amount": 400,
                "status": "pending"
            }
        }


# Pydantic schemas for API

class BookingCreate(BaseModel):
    """Schema for creating a new booking"""
    equipment_id: str
    booking_date: datetime  # The date for the booking
    start_time: datetime    # Start time
    hours: int = Field(ge=1, le=6, description="Hours to book (1-6)")
    promo_code: Optional[str] = None  # Optional promo code


class BookingResponse(BaseModel):
    """Schema for booking response"""
    id: str
    booking_id: str
    user_email: str
    equipment_id: str
    equipment_name: str
    hostel_name: str
    room_number: str
    booking_date: datetime
    start_time: datetime
    end_time: datetime
    hours_booked: int
    hours: int  # Alias for frontend compatibility
    extension_hours: int
    total_hours: int
    base_amount: int
    extension_amount: int
    total_amount: str  # Changed to string for display format
    status: BookingStatus
    payment_status: str  # Added for frontend
    is_paid: bool
    created_at: datetime
    # Delivery confirmation fields
    actual_start_time: Optional[datetime] = None
    actual_end_time: Optional[datetime] = None
    delivery_confirmed: bool = False
    delivery_photo_url: Optional[str] = None
    # Pending extension fields
    pending_extension_hours: int = 0
    pending_extension_amount: int = 0
    has_pending_extension: bool = False
    
    class Config:
        from_attributes = True


class BookingExtend(BaseModel):
    """Schema for extending a booking"""
    additional_hours: int = Field(ge=1, le=4, description="Additional hours (1-4)")


class BookingCancel(BaseModel):
    """Schema for cancelling a booking"""
    reason: Optional[str] = None


class BookingStatusUpdate(BaseModel):
    """Schema for admin to update booking status"""
    status: BookingStatus
    admin_notes: Optional[str] = None


class PaymentInfo(BaseModel):
    """Payment information to display to user"""
    booking_id: str
    amount_to_pay: int
    currency: str = "GHS"
    momo_number: str
    momo_name: str
    instructions: str
