"""
Equipment Model - MongoDB Document
Represents PS5 + TV gaming sets available for rental
"""
from datetime import datetime
from typing import Optional
from enum import Enum
from beanie import Document, Indexed
from pydantic import BaseModel, Field


class EquipmentStatus(str, Enum):
    AVAILABLE = "available"      # Ready to be booked
    BOOKED = "booked"           # Currently reserved
    IN_USE = "in_use"           # Delivered and being used
    MAINTENANCE = "maintenance"  # Under repair/not available
    DELIVERED = "delivered"      # En route to customer


class Equipment(Document):
    """Gaming equipment document stored in MongoDB"""
    
    # Equipment identification
    name: str  # e.g., "PS5 Set 1", "PS5 Set 2"
    equipment_id: str = Field(..., unique=True)  # e.g., "PS5-001"
    
    # Description
    description: str = "PlayStation 5 with TV and 2 controllers"
    
    # Components included
    components: list[str] = [
        "PlayStation 5 Console",
        "32-inch TV",
        "2 DualSense Controllers",
        "HDMI Cable",
        "Power Cables"
    ]
    
    # Status
    status: EquipmentStatus = EquipmentStatus.AVAILABLE
    
    # Current booking (if any)
    current_booking_id: Optional[str] = None
    
    # Pricing (in Ghana Cedis)
    hourly_rate: int = 70
    
    # Tracking
    total_bookings: int = 0
    total_hours_rented: int = 0
    total_revenue: int = 0
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_maintenance: Optional[datetime] = None
    
    class Settings:
        name = "equipment"
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "PS5 Gaming Set 1",
                "equipment_id": "PS5-001",
                "description": "PlayStation 5 with TV and 2 controllers",
                "status": "available",
                "hourly_rate": 70
            }
        }


# Pydantic schemas for API

class EquipmentCreate(BaseModel):
    """Schema for adding new equipment (admin only)"""
    name: str
    equipment_id: str
    description: Optional[str] = "PlayStation 5 with TV and 2 controllers"
    components: Optional[list[str]] = None
    hourly_rate: int = 70


class EquipmentResponse(BaseModel):
    """Schema for equipment response"""
    id: str
    name: str
    equipment_id: str
    description: str
    components: list[str]
    status: EquipmentStatus
    hourly_rate: int
    total_bookings: int
    
    class Config:
        from_attributes = True


class EquipmentUpdate(BaseModel):
    """Schema for updating equipment"""
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[EquipmentStatus] = None
    hourly_rate: Optional[int] = None


class EquipmentAvailability(BaseModel):
    """Schema showing equipment availability"""
    equipment_id: str
    name: str
    is_available: bool
    next_available: Optional[datetime] = None
    hourly_rate: int
