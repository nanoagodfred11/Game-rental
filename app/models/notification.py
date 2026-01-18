"""
Notification Model - MongoDB Document
Represents user and admin notifications
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from beanie import Document
from pydantic import BaseModel, Field


class NotificationType(str, Enum):
    PAYMENT_CONFIRMED = "payment_confirmed"
    BOOKING_CONFIRMED = "booking_confirmed"
    EQUIPMENT_DISPATCHED = "equipment_dispatched"
    DELIVERY_CONFIRMED = "delivery_confirmed"
    SESSION_STARTED = "session_started"
    SESSION_ENDING_SOON = "session_ending_soon"
    SESSION_EXTENDED = "session_extended"
    SESSION_COMPLETED = "session_completed"
    BOOKING_CANCELLED = "booking_cancelled"
    ADMIN_ALERT = "admin_alert"


class Notification(Document):
    """Notification document stored in MongoDB"""
    
    notification_id: str = Field(..., unique=True)
    
    # Target user (null for admin notifications)
    user_id: Optional[str] = None
    user_email: Optional[str] = None
    
    # For admin notifications
    is_admin_notification: bool = False
    
    # Notification details
    notification_type: NotificationType
    title: str
    message: str
    
    # Related booking
    booking_id: Optional[str] = None
    
    # Read status
    is_read: bool = False
    read_at: Optional[datetime] = None
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Settings:
        name = "notifications"


class NotificationResponse(BaseModel):
    """Schema for notification response"""
    id: str
    notification_id: str
    notification_type: NotificationType
    title: str
    message: str
    booking_id: Optional[str]
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True
