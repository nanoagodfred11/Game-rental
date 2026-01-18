"""
Booking Routes
Create, view, extend, and cancel bookings
"""
from datetime import datetime, timedelta
from typing import List, Optional
import base64
import os
from fastapi import APIRouter, HTTPException, status, Depends, Query, UploadFile, File, Form
from app.models.user import User, UserRole
from app.models.equipment import Equipment, EquipmentStatus
from app.models.booking import (
    Booking, BookingCreate, BookingResponse, BookingExtend, 
    BookingCancel, BookingStatus, PaymentInfo
)
from app.models.payment import Payment, PaymentStatus, PaymentType
from app.models.notification import Notification, NotificationType
from app.models.promo import PromoCode, DiscountType
from app.services.auth import get_current_user
from app.services.utils import generate_booking_id, generate_payment_id, generate_notification_id, calculate_booking_amount
from app.config import settings


router = APIRouter(prefix="/bookings", tags=["Bookings"])


@router.get("/available", response_model=List[dict])
async def get_available_equipment(
    date: Optional[datetime] = Query(None, description="Date to check availability"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all gaming equipment with their availability status
    
    Equipment can have multiple bookings at different time slots.
    Shows current status and upcoming bookings.
    """
    if date is None:
        date = datetime.utcnow()
    
    # Get all equipment
    all_equipment = await Equipment.find_all().to_list()
    
    available = []
    for equip in all_equipment:
        # Skip equipment under maintenance
        if equip.status == EquipmentStatus.MAINTENANCE:
            available.append({
                "id": str(equip.id),
                "equipment_id": equip.equipment_id,
                "name": equip.name,
                "description": equip.description,
                "components": equip.components,
                "hourly_rate": equip.hourly_rate,
                "is_available": False,
                "next_available": None,
                "current_booking": None,
                "status_message": "Under maintenance"
            })
            continue
        
        # Check for currently active session (IN_USE, DELIVERED, AWAITING_CONFIRMATION, EXTENDED)
        now = datetime.utcnow()
        # Use string values for MongoDB query
        active_statuses = [
            BookingStatus.DELIVERED.value,
            BookingStatus.IN_USE.value, 
            BookingStatus.AWAITING_CONFIRMATION.value,
            BookingStatus.EXTENDED.value
        ]
        active_session = await Booking.find_one(
            {
                "equipment_id": equip.equipment_id,
                "status": {"$in": active_statuses},
            }
        )
        
        if active_session:
            # Equipment is currently being used
            end_time = active_session.actual_end_time or active_session.end_time
            available.append({
                "id": str(equip.id),
                "equipment_id": equip.equipment_id,
                "name": equip.name,
                "description": equip.description,
                "components": equip.components,
                "hourly_rate": equip.hourly_rate,
                "is_available": False,
                "next_available": end_time.isoformat() if end_time else None,
                "current_booking": {
                    "booking_id": active_session.booking_id,
                    "status": active_session.status,
                    "start_time": active_session.start_time.isoformat() if active_session.start_time else None,
                    "end_time": end_time.isoformat() if end_time else None,
                    "is_mine": active_session.user_id == str(current_user.id)
                },
                "status_message": "Currently in use"
            })
        else:
            # Equipment is available - but may have future bookings
            # Get upcoming confirmed bookings for this equipment
            upcoming_statuses = [
                BookingStatus.PENDING.value,
                BookingStatus.PAYMENT_RECEIVED.value,
                BookingStatus.CONFIRMED.value
            ]
            upcoming_bookings = await Booking.find(
                {
                    "equipment_id": equip.equipment_id,
                    "status": {"$in": upcoming_statuses},
                    "start_time": {"$gte": now}
                }
            ).sort("start_time").to_list()
            
            upcoming_info = []
            for ub in upcoming_bookings[:3]:  # Show next 3 bookings
                upcoming_info.append({
                    "start_time": ub.start_time.isoformat(),
                    "end_time": ub.end_time.isoformat(),
                    "is_mine": ub.user_id == str(current_user.id)
                })
            
            available.append({
                "id": str(equip.id),
                "equipment_id": equip.equipment_id,
                "name": equip.name,
                "description": equip.description,
                "components": equip.components,
                "hourly_rate": equip.hourly_rate,
                "is_available": True,
                "next_available": None,
                "current_booking": None,
                "upcoming_bookings": upcoming_info,
                "status_message": "Available for booking"
            })
    
    return available


import traceback

@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_data: BookingCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new booking for gaming equipment
    
    - **equipment_id**: ID of the equipment to book
    - **booking_date**: Date of the booking
    - **start_time**: When you want to start playing
    - **hours**: Number of hours (2-6)
    
    After booking, you'll receive payment instructions for MTN Mobile Money.
    """
    try:
        # Validate hours
        if booking_data.hours < settings.min_booking_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Minimum booking is {settings.min_booking_hours} hours"
            )
        if booking_data.hours > settings.max_booking_hours:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Maximum booking is {settings.max_booking_hours} hours"
            )
        # Find equipment
        equipment = await Equipment.find_one(Equipment.equipment_id == booking_data.equipment_id)
        if not equipment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Equipment not found"
            )
        
        # Check if equipment is under maintenance
        if equipment.status == EquipmentStatus.MAINTENANCE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Equipment is under maintenance. Please choose another."
            )
        
        # Check for conflicting bookings (time-slot based)
        # Equipment can have multiple future bookings as long as time slots don't overlap
        # Two time ranges overlap if: start1 < end2 AND start2 < end1
        end_time = booking_data.start_time + timedelta(hours=booking_data.hours)
        # Use string values for MongoDB query
        blocking_statuses = [
            BookingStatus.PENDING.value,
            BookingStatus.PAYMENT_RECEIVED.value,
            BookingStatus.CONFIRMED.value,
            BookingStatus.DELIVERED.value,
            BookingStatus.IN_USE.value,
            BookingStatus.AWAITING_CONFIRMATION.value,
            BookingStatus.EXTENDED.value
        ]
        conflicting = await Booking.find_one(
            {
                "equipment_id": booking_data.equipment_id,
                "status": {"$in": blocking_statuses},
                # Simple overlap check: new_start < existing_end AND existing_start < new_end
                "start_time": {"$lt": end_time},
                "end_time": {"$gt": booking_data.start_time}
            }
        )
        if conflicting:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Time slot conflicts with another booking ({conflicting.start_time.strftime('%H:%M')} - {conflicting.end_time.strftime('%H:%M')}). Please choose a different time."
            )
        
        # Calculate base amount
        base_amount = calculate_booking_amount(booking_data.hours, equipment.hourly_rate)
        total_amount = base_amount
        discount_amount = 0
        promo_code_used = None
        
        # Apply promo code if provided
        if booking_data.promo_code:
            promo = await PromoCode.find_one(PromoCode.code == booking_data.promo_code.upper())
            if promo and promo.is_active:
                now = datetime.utcnow()
                # Validate promo code
                is_valid = True
                if now < promo.valid_from:
                    is_valid = False
                if promo.valid_until and now > promo.valid_until:
                    is_valid = False
                if promo.max_uses and promo.current_uses >= promo.max_uses:
                    is_valid = False
                if promo.used_by.count(str(current_user.id)) >= promo.max_uses_per_user:
                    is_valid = False
                if booking_data.hours < promo.min_hours:
                    is_valid = False
                if promo.first_booking_only:
                    # Only count completed bookings (not pending/cancelled ones)
                    completed_statuses = [
                        BookingStatus.COMPLETED.value,
                        BookingStatus.IN_USE.value,
                        BookingStatus.EXTENDED.value
                    ]
                    user_completed_bookings = await Booking.find(
                        {
                            "user_id": str(current_user.id),
                            "status": {"$in": completed_statuses}
                        }
                    ).count()
                    if user_completed_bookings > 0:
                        is_valid = False
                
                if is_valid:
                    # Calculate discount
                    if promo.discount_type == DiscountType.PERCENTAGE:
                        discount_amount = int(base_amount * promo.discount_value / 100)
                        if promo.max_discount and discount_amount > promo.max_discount:
                            discount_amount = promo.max_discount
                    elif promo.discount_type == DiscountType.FIXED:
                        discount_amount = min(promo.discount_value, base_amount)
                    elif promo.discount_type == DiscountType.FREE_HOURS:
                        free_hours = min(promo.discount_value, booking_data.hours - 1)
                        discount_amount = free_hours * equipment.hourly_rate
                    
                    total_amount = base_amount - discount_amount
                    promo_code_used = promo.code
                    
                    # Update promo usage
                    promo.current_uses += 1
                    promo.used_by.append(str(current_user.id))
                    await promo.save()
        
        # Create booking - ensure total_hours is always set
        hours = booking_data.hours
        booking = Booking(
            booking_id=generate_booking_id(),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_phone=current_user.phone_number,
            equipment_id=equipment.equipment_id,
            equipment_name=equipment.name,
            hostel_name=current_user.hostel_name,
            room_number=current_user.room_number,
            booking_date=booking_data.booking_date,
            start_time=booking_data.start_time,
            end_time=end_time,
            hours_booked=hours,
            total_hours=hours,  # Always set, never 0
            hourly_rate=equipment.hourly_rate,
            base_amount=base_amount,
            total_amount=total_amount,
            discount_amount=discount_amount,
            promo_code_used=promo_code_used,
            extension_hours=0,
            extension_amount=0,
            status=BookingStatus.PENDING
        )
        await booking.insert()
        # Create pending payment record
        payment = Payment(
            payment_id=generate_payment_id(),
            user_id=str(current_user.id),
            user_email=current_user.email,
            user_phone=current_user.phone_number,
            booking_id=booking.booking_id,
            payment_type=PaymentType.BOOKING,
            amount=total_amount,
            momo_number_to=settings.momo_number,
            momo_name_to=settings.momo_name,
            status=PaymentStatus.PENDING
        )
        await payment.insert()
        
        # DON'T mark equipment as booked immediately!
        # Equipment stays AVAILABLE so other users can book different time slots
        # Equipment only becomes BOOKED/IN_USE when admin starts delivery/session
        
        # Update equipment stats only
        equipment.total_bookings += 1
        await equipment.save()
        # Return booking with payment instructions
        # Build response message
        discount_msg = ""
        if discount_amount > 0:
            discount_msg = f" (GH₵{discount_amount} discount applied with code {promo_code_used}!)"
        
        return {
            "message": f"Booking created successfully!{discount_msg} Please complete payment.",
            "booking": {
                "booking_id": booking.booking_id,
                "equipment": equipment.name,
                "date": booking.booking_date.isoformat(),
                "start_time": booking.start_time.isoformat(),
                "end_time": booking.end_time.isoformat(),
                "hours": booking.hours_booked,
                "base_amount": f"GH₵ {base_amount}",
                "discount_amount": f"GH₵ {discount_amount}" if discount_amount > 0 else None,
                "promo_code": promo_code_used,
                "total_amount": f"GH₵ {total_amount}",
                "status": booking.status
            },
            "payment_instructions": {
                "payment_id": payment.payment_id,
                "amount": total_amount,
                "currency": "GHS",
                "momo_number": settings.momo_number,
                "momo_name": settings.momo_name,
                "steps": [
                    "1. Open your MTN Mobile Money app or dial *170#",
                    "2. Select 'Send Money' or 'Transfer'",
                    f"3. Enter number: {settings.momo_number}",
                    f"4. Enter amount: GH₵ {total_amount}",
                    f"5. Reference: {booking.booking_id}",
                    "6. Confirm the transaction",
                    "7. Submit your payment details using the /payments/confirm endpoint"
                ],
                "important": [
                    "⚠️ Use your booking ID as the reference",
                    "⚠️ Payment must be made before delivery",
                    "⚠️ Keep your MoMo transaction ID for confirmation"
                ]
            }
        }
    except Exception as e:
        print("[BOOKING ERROR]", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error. Please contact support.")


@router.get("/my-bookings", response_model=List[BookingResponse])
async def get_my_bookings(
    status_filter: Optional[BookingStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all your bookings
    
    - **status**: Optional filter by booking status
    """
    query = Booking.find(Booking.user_id == str(current_user.id))
    
    if status_filter:
        query = Booking.find(
            Booking.user_id == str(current_user.id),
            Booking.status == status_filter
        )
    
    bookings = await query.sort(-Booking.created_at).to_list()
    
    return [
        BookingResponse(
            id=str(b.id),
            booking_id=b.booking_id,
            user_email=b.user_email,
            equipment_id=b.equipment_id,
            equipment_name=b.equipment_name,
            hostel_name=b.hostel_name,
            room_number=b.room_number,
            booking_date=b.booking_date,
            start_time=b.actual_start_time if b.actual_start_time else b.start_time,
            end_time=b.actual_end_time if b.actual_end_time else b.end_time,
            hours_booked=b.hours_booked,
            hours=b.total_hours if b.total_hours else b.hours_booked,
            extension_hours=b.extension_hours if b.extension_hours else 0,
            total_hours=b.total_hours if b.total_hours else b.hours_booked,
            base_amount=b.base_amount if b.base_amount else 0,
            extension_amount=b.extension_amount if b.extension_amount else 0,
            total_amount=f"GH₵ {b.total_amount if b.total_amount else 0}",
            status=b.status,
            payment_status="paid" if b.is_paid else "pending",
            is_paid=b.is_paid if b.is_paid is not None else False,
            created_at=b.created_at,
            actual_start_time=b.actual_start_time,
            actual_end_time=b.actual_end_time,
            delivery_confirmed=b.delivery_confirmed_at is not None,
            delivery_photo_url=b.delivery_photo_url,
            pending_extension_hours=b.pending_extension_hours if b.pending_extension_hours else 0,
            pending_extension_amount=b.pending_extension_amount if b.pending_extension_amount else 0,
            has_pending_extension=bool(b.pending_extension_hours and b.pending_extension_hours > 0)
        )
        for b in bookings
    ]


@router.get("/{booking_id}", response_model=BookingResponse)
async def get_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get details of a specific booking
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Users can only view their own bookings (admins can view all)
    if booking.user_id != str(current_user.id) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this booking"
        )
    
    return BookingResponse(
        id=str(booking.id),
        booking_id=booking.booking_id,
        user_email=booking.user_email,
        equipment_id=booking.equipment_id,
        equipment_name=booking.equipment_name,
        hostel_name=booking.hostel_name,
        room_number=booking.room_number,
        booking_date=booking.booking_date,
        start_time=booking.actual_start_time if booking.actual_start_time else booking.start_time,
        end_time=booking.actual_end_time if booking.actual_end_time else booking.end_time,
        hours_booked=booking.hours_booked,
        hours=booking.total_hours if booking.total_hours else booking.hours_booked,
        extension_hours=booking.extension_hours,
        total_hours=booking.total_hours if booking.total_hours else booking.hours_booked,
        base_amount=booking.base_amount,
        extension_amount=booking.extension_amount,
        total_amount=f"GH₵ {booking.total_amount}",
        status=booking.status,
        payment_status="paid" if booking.is_paid else "pending",
        is_paid=booking.is_paid,
        created_at=booking.created_at,
        actual_start_time=booking.actual_start_time,
        actual_end_time=booking.actual_end_time,
        delivery_confirmed=booking.delivery_confirmed_at is not None,
        delivery_photo_url=booking.delivery_photo_url,
        pending_extension_hours=booking.pending_extension_hours if booking.pending_extension_hours else 0,
        pending_extension_amount=booking.pending_extension_amount if booking.pending_extension_amount else 0,
        has_pending_extension=bool(booking.pending_extension_hours and booking.pending_extension_hours > 0)
    )


@router.post("/{booking_id}/extend", response_model=dict)
async def extend_booking(
    booking_id: str,
    extension: BookingExtend,
    current_user: User = Depends(get_current_user)
):
    """
    Extend your current gaming session
    
    - **additional_hours**: Number of extra hours (1-4)
    
    Note: Extension payment must be made before the extra time is granted.
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if booking.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to extend this booking"
        )
    
    # Can only extend active bookings
    if booking.status not in [BookingStatus.DELIVERED, BookingStatus.IN_USE]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only extend active sessions"
        )
    
    # Check total hours don't exceed maximum
    new_total = booking.total_hours + extension.additional_hours
    if new_total > 10:  # Allow some flexibility for extensions
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot extend beyond 10 hours total. Current: {booking.total_hours}h"
        )
    
    # Calculate extension amount
    extension_amount = calculate_booking_amount(extension.additional_hours, booking.hourly_rate)
    
    # Create extension payment
    payment = Payment(
        payment_id=generate_payment_id(),
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_phone=current_user.phone_number,
        booking_id=booking.booking_id,
        payment_type=PaymentType.EXTENSION,
        amount=extension_amount,
        momo_number_to=settings.momo_number,
        momo_name_to=settings.momo_name,
        status=PaymentStatus.PENDING
    )
    
    await payment.insert()
    
    # Store original end time
    if not booking.original_end_time:
        booking.original_end_time = booking.end_time
    
    # Store as PENDING extension - hours will only be added after payment is confirmed
    booking.pending_extension_hours = extension.additional_hours
    booking.pending_extension_amount = extension_amount
    booking.pending_extension_payment_id = payment.payment_id
    booking.updated_at = datetime.utcnow()
    
    await booking.save()
    
    # Notify admin about extension request (payment pending)
    admin_notification = Notification(
        notification_id=generate_notification_id(),
        is_admin_notification=True,
        notification_type=NotificationType.SESSION_EXTENDED,
        title="Extension Requested! 💳 Payment Pending",
        message=f"Booking #{booking.booking_id} requested {extension.additional_hours} hour(s) extension. Amount: GH₵ {extension_amount}. Verify payment to apply extension.",
        booking_id=booking.booking_id
    )
    await admin_notification.insert()
    
    return {
        "message": "Extension requested! Please complete payment. Hours will be added after admin verifies payment.",
        "extension": {
            "additional_hours": extension.additional_hours,
            "pending": True,
            "extension_amount": f"GH₵ {extension_amount}",
            "current_total": f"GH₵ {booking.total_amount}"
        },
        "payment_instructions": {
            "payment_id": payment.payment_id,
            "amount": extension_amount,
            "momo_number": settings.momo_number,
            "momo_name": settings.momo_name,
            "reference": f"{booking.booking_id}-EXT"
        }
    }


@router.post("/{booking_id}/cancel", response_model=dict)
async def cancel_booking(
    booking_id: str,
    cancellation: BookingCancel,
    current_user: User = Depends(get_current_user)
):
    """
    Cancel a booking
    
    - Bookings can only be cancelled before delivery
    - Paid bookings will be marked for refund
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if booking.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to cancel this booking"
        )
    
    # Can only cancel before delivery
    if booking.status in [BookingStatus.DELIVERED, BookingStatus.IN_USE, BookingStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot cancel after equipment has been delivered"
        )
    
    # Update booking status
    booking.status = BookingStatus.CANCELLED
    booking.cancelled_at = datetime.utcnow()
    booking.admin_notes = f"Cancelled by user. Reason: {cancellation.reason or 'Not specified'}"
    
    await booking.save()
    
    # Free up equipment and decrement booking count
    equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
    if equipment:
        equipment.status = EquipmentStatus.AVAILABLE
        equipment.current_booking_id = None
        # Decrement total_bookings since this booking was cancelled
        if equipment.total_bookings > 0:
            equipment.total_bookings -= 1
        await equipment.save()

    # Handle refund if paid
    refund_message = ""
    if booking.is_paid:
        booking.status = BookingStatus.REFUNDED
        await booking.save()
        
        # Update payment status
        payment = await Payment.find_one(Payment.booking_id == booking.booking_id)
        if payment:
            payment.status = PaymentStatus.REFUNDED
            payment.notes = "Refund pending - booking cancelled"
            await payment.save()
        
        refund_message = f"Your payment of GH₵ {booking.total_amount} will be refunded to {current_user.phone_number}."
    
    return {
        "message": "Booking cancelled successfully",
        "booking_id": booking.booking_id,
        "refund_info": refund_message if refund_message else "No payment was made, no refund needed."
    }


@router.post("/{booking_id}/confirm-delivery", response_model=dict)
async def confirm_delivery(
    booking_id: str,
    photo: UploadFile = File(..., description="Photo of the setup"),
    current_user: User = Depends(get_current_user)
):
    """
    User confirms equipment delivery by uploading a photo of the setup.
    Photo is sent to admin for confirmation. Timer starts ONLY after admin confirms.
    
    - **photo**: Image file of the delivered setup
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if booking.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to confirm this delivery"
        )
    
    # Can only confirm delivery for confirmed/delivered bookings
    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.DELIVERED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm delivery. Booking status is '{booking.status}'"
        )
    
    # Save the photo
    try:
        # Create uploads directory if it doesn't exist
        upload_dir = "uploads/delivery_photos"
        os.makedirs(upload_dir, exist_ok=True)

        # Validate file extension - only allow image types
        ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png', 'gif', 'webp'}
        file_ext = 'jpg'  # Default to jpg
        if photo.filename and '.' in photo.filename:
            ext = photo.filename.rsplit('.', 1)[-1].lower()
            if ext in ALLOWED_EXTENSIONS:
                file_ext = ext

        # Validate content type
        if photo.content_type and not photo.content_type.startswith('image/'):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only image files are allowed"
            )

        # Read content and validate size (max 10MB)
        content = await photo.read()
        MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File too large. Maximum size is 10MB"
            )

        # Generate safe filename using only booking_id and timestamp
        filename = f"{booking.booking_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.{file_ext}"
        file_path = os.path.join(upload_dir, filename)

        # Save the file
        with open(file_path, "wb") as f:
            f.write(content)
        
        # Store relative path
        booking.delivery_photo_url = file_path
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save photo: {str(e)}"
        )
    
    # Update booking - set to awaiting confirmation, DON'T start timer yet
    now = datetime.utcnow()
    booking.delivery_confirmed_at = now
    booking.status = BookingStatus.AWAITING_CONFIRMATION
    booking.delivered_at = now
    booking.updated_at = now
    
    await booking.save()
    
    # Create notification for admin to review the setup photo
    admin_notification = Notification(
        notification_id=generate_notification_id(),
        is_admin_notification=True,
        notification_type=NotificationType.DELIVERY_CONFIRMED,
        title="Setup Photo Uploaded! 📷 Action Required",
        message=f"User {current_user.full_name} ({current_user.email}) uploaded a setup photo for booking #{booking.booking_id}. Please review and confirm to start the timer.",
        booking_id=booking.booking_id
    )
    await admin_notification.insert()
    
    return {
        "message": "Photo uploaded! Waiting for admin to confirm setup before your session starts.",
        "booking_id": booking.booking_id,
        "status": "awaiting_confirmation",
        "hours_booked": booking.total_hours if booking.total_hours else booking.hours_booked
    }


@router.post("/{booking_id}/confirm-delivery-base64", response_model=dict)
async def confirm_delivery_base64(
    booking_id: str,
    current_user: User = Depends(get_current_user),
    photo_data: str = Form(..., description="Base64 encoded photo data")
):
    """
    User confirms equipment delivery by uploading a base64 photo (for camera capture).
    Photo is sent to admin for confirmation. Timer starts ONLY after admin confirms.
    
    - **photo_data**: Base64 encoded image string
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if booking.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to confirm this delivery"
        )
    
    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.DELIVERED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm delivery. Booking status is '{booking.status}'"
        )
    
    # Save the base64 photo
    try:
        upload_dir = "uploads/delivery_photos"
        os.makedirs(upload_dir, exist_ok=True)

        # Validate base64 string length before decoding (rough size check)
        # Base64 is ~4/3 the size of binary, so 14MB base64 ≈ 10MB file
        MAX_BASE64_LENGTH = 14 * 1024 * 1024
        if len(photo_data) > MAX_BASE64_LENGTH:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo too large. Maximum size is 10MB"
            )

        # Remove data URL prefix if present
        if ',' in photo_data:
            photo_data = photo_data.split(',')[1]

        # Decode base64
        try:
            image_data = base64.b64decode(photo_data)
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid base64 image data"
            )

        # Validate decoded size (max 10MB)
        MAX_FILE_SIZE = 10 * 1024 * 1024
        if len(image_data) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Photo too large. Maximum size is 10MB"
            )

        filename = f"{booking.booking_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.jpg"
        file_path = os.path.join(upload_dir, filename)

        with open(file_path, "wb") as f:
            f.write(image_data)

        booking.delivery_photo_url = file_path
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save photo: {str(e)}"
        )
    
    # Update booking - set to awaiting confirmation, DON'T start timer yet
    now = datetime.utcnow()
    booking.delivery_confirmed_at = now
    booking.status = BookingStatus.AWAITING_CONFIRMATION
    booking.delivered_at = now
    booking.updated_at = now
    
    await booking.save()
    
    # Create notification for admin to review the setup photo
    admin_notification = Notification(
        notification_id=generate_notification_id(),
        is_admin_notification=True,
        notification_type=NotificationType.DELIVERY_CONFIRMED,
        title="Setup Photo Uploaded! 📷 Action Required",
        message=f"User {current_user.full_name} uploaded a setup photo for booking #{booking.booking_id}. Please review and confirm to start the timer.",
        booking_id=booking.booking_id
    )
    await admin_notification.insert()
    
    return {
        "message": "Photo uploaded! Waiting for admin to confirm setup before your session starts.",
        "booking_id": booking.booking_id,
        "status": "awaiting_confirmation",
        "hours_booked": booking.total_hours if booking.total_hours else booking.hours_booked
    }


@router.get("/notifications/my", response_model=List[dict])
async def get_my_notifications(
    unread_only: bool = Query(False, description="Only return unread notifications"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all notifications for the current user
    """
    query = {"user_id": str(current_user.id)}
    if unread_only:
        query["is_read"] = False
    
    notifications = await Notification.find(query).sort(-Notification.created_at).to_list()
    
    return [
        {
            "id": str(n.id),
            "notification_id": n.notification_id,
            "type": n.notification_type,
            "title": n.title,
            "message": n.message,
            "booking_id": n.booking_id,
            "is_read": n.is_read,
            "created_at": n.created_at.isoformat()
        }
        for n in notifications
    ]


@router.post("/notifications/{notification_id}/read", response_model=dict)
async def mark_notification_read(
    notification_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Mark a notification as read
    """
    notification = await Notification.find_one(Notification.notification_id == notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    # Admin notifications have no user_id - users can't mark them as read
    # (admins use /admin/notifications/{id}/read instead)
    if notification.is_admin_notification or notification.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to modify admin notifications"
        )

    if notification.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized"
        )
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await notification.save()
    
    return {"message": "Notification marked as read"}


@router.post("/notifications/read-all", response_model=dict)
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user)
):
    """
    Mark all notifications as read
    """
    await Notification.find(
        Notification.user_id == str(current_user.id),
        Notification.is_read == False
    ).update({"$set": {"is_read": True, "read_at": datetime.utcnow()}})
    
    return {"message": "All notifications marked as read"}
