"""
Admin Routes
Manage equipment, bookings, payments, and users
Only accessible by admin users
"""
from datetime import datetime, timedelta
from typing import List, Optional
import os
from fastapi import APIRouter, HTTPException, status, Depends, Query
from fastapi.responses import FileResponse
from app.models.user import User, UserRole, UserResponse
from app.models.equipment import Equipment, EquipmentCreate, EquipmentResponse, EquipmentUpdate, EquipmentStatus
from app.models.booking import Booking, BookingResponse, BookingStatus, BookingStatusUpdate
from app.models.payment import Payment, PaymentStatus, PaymentResponse, PaymentVerify
from app.models.notification import Notification, NotificationType
from app.models.review import Review, AdminReviewResponse
from app.models.promo import PromoCode, PromoCodeCreate, PromoCodeResponse, DiscountType
from app.services.auth import get_current_admin_user, hash_password
from app.services.utils import generate_equipment_id, generate_notification_id
from app.config import settings


router = APIRouter(prefix="/admin", tags=["Admin"])


# ==================== EQUIPMENT MANAGEMENT ====================

@router.post("/equipment", response_model=EquipmentResponse, status_code=status.HTTP_201_CREATED)
async def add_equipment(
    equipment_data: EquipmentCreate,
    admin: User = Depends(get_current_admin_user)
):
    """
    Add new gaming equipment to inventory
    
    - **name**: Display name (e.g., "PS5 Gaming Set 1")
    - **equipment_id**: Unique ID (e.g., "PS5-001")
    - **description**: Description of the equipment
    - **hourly_rate**: Rental rate per hour (default: 70)
    """
    # Check if equipment_id already exists
    existing = await Equipment.find_one(Equipment.equipment_id == equipment_data.equipment_id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Equipment ID already exists"
        )
    
    equipment = Equipment(
        name=equipment_data.name,
        equipment_id=equipment_data.equipment_id,
        description=equipment_data.description or "PlayStation 5 with TV and 2 controllers",
        components=equipment_data.components or [
            "PlayStation 5 Console",
            "32-inch TV",
            "2 DualSense Controllers",
            "HDMI Cable",
            "Power Cables"
        ],
        hourly_rate=equipment_data.hourly_rate
    )
    
    await equipment.insert()
    
    return EquipmentResponse(
        id=str(equipment.id),
        name=equipment.name,
        equipment_id=equipment.equipment_id,
        description=equipment.description,
        components=equipment.components,
        status=equipment.status,
        hourly_rate=equipment.hourly_rate,
        total_bookings=equipment.total_bookings
    )


@router.get("/equipment", response_model=List[EquipmentResponse])
async def list_all_equipment(
    admin: User = Depends(get_current_admin_user)
):
    """
    List all equipment in inventory
    """
    equipment_list = await Equipment.find_all().to_list()
    
    return [
        EquipmentResponse(
            id=str(e.id),
            name=e.name,
            equipment_id=e.equipment_id,
            description=e.description,
            components=e.components,
            status=e.status,
            hourly_rate=e.hourly_rate,
            total_bookings=e.total_bookings
        )
        for e in equipment_list
    ]


@router.put("/equipment/{equipment_id}", response_model=EquipmentResponse)
async def update_equipment(
    equipment_id: str,
    update_data: EquipmentUpdate,
    admin: User = Depends(get_current_admin_user)
):
    """
    Update equipment details
    """
    equipment = await Equipment.find_one(Equipment.equipment_id == equipment_id)
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    if update_data.name:
        equipment.name = update_data.name
    if update_data.description:
        equipment.description = update_data.description
    if update_data.status:
        equipment.status = update_data.status
    if update_data.hourly_rate:
        equipment.hourly_rate = update_data.hourly_rate
    
    equipment.updated_at = datetime.utcnow()
    await equipment.save()
    
    return EquipmentResponse(
        id=str(equipment.id),
        name=equipment.name,
        equipment_id=equipment.equipment_id,
        description=equipment.description,
        components=equipment.components,
        status=equipment.status,
        hourly_rate=equipment.hourly_rate,
        total_bookings=equipment.total_bookings
    )


@router.delete("/equipment/{equipment_id}")
async def delete_equipment(
    equipment_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Delete equipment from inventory
    """
    equipment = await Equipment.find_one(Equipment.equipment_id == equipment_id)
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    if equipment.status != EquipmentStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete equipment that is currently booked or in use"
        )
    
    await equipment.delete()
    
    return {"message": f"Equipment {equipment_id} deleted successfully"}


@router.post("/equipment/{equipment_id}/reset", response_model=dict)
async def reset_equipment_status(
    equipment_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Force reset equipment to AVAILABLE status and cancel any stuck bookings.
    Use this to fix equipment stuck in 'delivered' or other states.
    """
    equipment = await Equipment.find_one(Equipment.equipment_id == equipment_id)
    
    if not equipment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Equipment not found"
        )
    
    # Find and cancel any active/stuck bookings for this equipment
    stuck_statuses = [
        BookingStatus.DELIVERED.value,
        BookingStatus.AWAITING_CONFIRMATION.value,
        BookingStatus.IN_USE.value,
        BookingStatus.EXTENDED.value
    ]
    
    stuck_bookings = await Booking.find(
        {
            "equipment_id": equipment_id,
            "status": {"$in": stuck_statuses}
        }
    ).to_list()
    
    cancelled_count = 0
    for booking in stuck_bookings:
        booking.status = BookingStatus.CANCELLED
        booking.cancelled_at = datetime.utcnow()
        booking.admin_notes = (booking.admin_notes or "") + f" [Admin force-reset by {admin.email}]"
        booking.updated_at = datetime.utcnow()
        await booking.save()
        cancelled_count += 1
    
    # Reset equipment status
    old_status = equipment.status
    equipment.status = EquipmentStatus.AVAILABLE
    equipment.current_booking_id = None
    equipment.updated_at = datetime.utcnow()
    await equipment.save()
    
    return {
        "message": f"Equipment {equipment_id} reset to AVAILABLE",
        "previous_status": old_status,
        "bookings_cancelled": cancelled_count
    }


# ==================== BOOKING MANAGEMENT ====================

@router.get("/bookings", response_model=List[BookingResponse])
async def list_all_bookings(
    status_filter: Optional[BookingStatus] = Query(None),
    admin: User = Depends(get_current_admin_user)
):
    """
    List all bookings (with optional status filter)
    """
    if status_filter:
        bookings = await Booking.find(Booking.status == status_filter).sort(-Booking.created_at).to_list()
    else:
        bookings = await Booking.find_all().sort(-Booking.created_at).to_list()
    
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
            start_time=b.start_time,
            end_time=b.end_time,
            hours_booked=b.hours_booked,
            hours=b.total_hours,
            extension_hours=b.extension_hours,
            total_hours=b.total_hours,
            base_amount=b.base_amount,
            extension_amount=b.extension_amount,
            total_amount=f"GH₵ {b.total_amount}",
            status=b.status,
            payment_status="paid" if b.is_paid else "pending",
            is_paid=b.is_paid,
            created_at=b.created_at
        )
        for b in bookings
    ]


@router.put("/bookings/{booking_id}/status", response_model=dict)
async def update_booking_status(
    booking_id: str,
    status_update: BookingStatusUpdate,
    admin: User = Depends(get_current_admin_user)
):
    """
    Update booking status
    
    Status flow:
    - PENDING → PAYMENT_RECEIVED (after verifying payment)
    - PAYMENT_RECEIVED → CONFIRMED (ready for delivery)
    - CONFIRMED → DELIVERED (equipment delivered)
    - DELIVERED → IN_USE (customer playing)
    - IN_USE → COMPLETED (session ended, equipment returned)
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        # Try by ObjectId as fallback
        try:
            from bson import ObjectId
            booking = await Booking.get(ObjectId(booking_id))
        except:
            pass
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    old_status = booking.status
    new_status = status_update.status
    
    # Validate status transitions - prevent invalid jumps
    valid_transitions = {
        BookingStatus.PENDING: [BookingStatus.PAYMENT_RECEIVED, BookingStatus.CANCELLED],
        BookingStatus.PAYMENT_RECEIVED: [BookingStatus.CONFIRMED, BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        BookingStatus.CONFIRMED: [BookingStatus.DELIVERED, BookingStatus.CANCELLED, BookingStatus.REFUNDED],
        BookingStatus.DELIVERED: [BookingStatus.IN_USE, BookingStatus.AWAITING_CONFIRMATION, BookingStatus.CANCELLED],
        BookingStatus.AWAITING_CONFIRMATION: [BookingStatus.IN_USE, BookingStatus.CANCELLED],
        BookingStatus.IN_USE: [BookingStatus.COMPLETED, BookingStatus.EXTENDED],
        BookingStatus.EXTENDED: [BookingStatus.COMPLETED],
        BookingStatus.COMPLETED: [],  # Terminal state
        BookingStatus.CANCELLED: [],  # Terminal state
        BookingStatus.REFUNDED: [],   # Terminal state
    }
    
    if new_status not in valid_transitions.get(old_status, []):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status transition: {old_status} → {new_status}. Allowed: {valid_transitions.get(old_status, [])}"
        )
    
    booking.status = new_status
    
    if status_update.admin_notes:
        booking.admin_notes = status_update.admin_notes
    
    # Update timestamps and equipment status based on booking status
    if new_status == BookingStatus.CONFIRMED:
        # Booking confirmed for scheduled time - equipment stays available for other slots
        # Equipment will be marked BOOKED only when delivery actually starts
        booking.confirmed_at = datetime.utcnow()
    
    elif new_status == BookingStatus.DELIVERED:
        booking.delivered_at = datetime.utcnow()
        # NOW mark equipment as in use - delivery has started
        equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
        if equipment:
            equipment.status = EquipmentStatus.DELIVERED
            equipment.current_booking_id = booking.booking_id
            await equipment.save()
    
    elif new_status == BookingStatus.IN_USE:
        # Set actual session start and end times
        now = datetime.utcnow()
        total_hours = booking.total_hours if booking.total_hours else booking.hours_booked
        if total_hours == 0:
            total_hours = booking.hours_booked  # Fallback
        booking.actual_start_time = now
        booking.actual_end_time = now + timedelta(hours=total_hours)
        
        equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
        if equipment:
            equipment.status = EquipmentStatus.IN_USE
            await equipment.save()
    
    elif new_status == BookingStatus.COMPLETED:
        booking.completed_at = datetime.utcnow()
        # Free up equipment
        equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
        if equipment:
            equipment.status = EquipmentStatus.AVAILABLE
            equipment.current_booking_id = None
            # Don't increment total_bookings here - already done when booking created
            actual_hours = booking.total_hours if booking.total_hours else booking.hours_booked
            equipment.total_hours_rented += actual_hours
            equipment.total_revenue += booking.total_amount
            await equipment.save()
    
    elif new_status == BookingStatus.CANCELLED:
        booking.cancelled_at = datetime.utcnow()
        # Free up equipment if it was assigned
        equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
        if equipment:
            if equipment.current_booking_id == booking.booking_id:
                equipment.status = EquipmentStatus.AVAILABLE
                equipment.current_booking_id = None
            # Decrement total_bookings since this booking was cancelled
            if equipment.total_bookings > 0:
                equipment.total_bookings -= 1
            await equipment.save()
    
    booking.updated_at = datetime.utcnow()
    await booking.save()
    
    return {
        "message": f"Booking status updated: {old_status} → {new_status}",
        "booking_id": booking.booking_id,
        "new_status": booking.status,
        "customer": {
            "email": booking.user_email,
            "phone": booking.user_phone,
            "location": f"{booking.hostel_name}, Room {booking.room_number}"
        }
    }


# ==================== PAYMENT VERIFICATION ====================

@router.get("/payments", response_model=List[PaymentResponse])
async def list_all_payments(
    status_filter: Optional[PaymentStatus] = Query(None),
    admin: User = Depends(get_current_admin_user)
):
    """
    List all payments (with optional status filter)
    """
    if status_filter:
        payments = await Payment.find(Payment.status == status_filter).sort(-Payment.created_at).to_list()
    else:
        payments = await Payment.find_all().sort(-Payment.created_at).to_list()
    
    return [
        PaymentResponse(
            id=str(p.id),
            payment_id=p.payment_id,
            booking_id=p.booking_id,
            payment_type=p.payment_type,
            amount=p.amount,
            currency=p.currency,
            momo_number_to=p.momo_number_to,
            momo_name_to=p.momo_name_to,
            status=p.status,
            momo_transaction_id=p.momo_transaction_id,
            created_at=p.created_at,
            verified_at=p.verified_at
        )
        for p in payments
    ]


@router.get("/payments/pending", response_model=List[dict])
async def list_pending_payments(
    admin: User = Depends(get_current_admin_user)
):
    """
    List payments awaiting verification
    """
    payments = await Payment.find(
        Payment.status == PaymentStatus.PROCESSING
    ).sort(-Payment.created_at).to_list()
    
    result = []
    for p in payments:
        result.append({
            "payment_id": p.payment_id,
            "booking_id": p.booking_id,
            "amount": f"GH₵ {p.amount}",
            "customer_phone": p.momo_number_from,
            "transaction_id": p.momo_transaction_id,
            "created_at": p.created_at.isoformat(),
            "action_needed": "Verify this payment in your MoMo transaction history"
        })
    
    return result


@router.post("/payments/{payment_id}/verify", response_model=dict)
async def verify_payment(
    payment_id: str,
    verification: PaymentVerify,
    admin: User = Depends(get_current_admin_user)
):
    """
    Verify a payment after checking MoMo transaction
    
    - **status**: COMPLETED (verified) or FAILED (not found/invalid)
    - **notes**: Optional notes about the verification
    """
    payment = await Payment.find_one(Payment.payment_id == payment_id)
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    # Update payment
    payment.status = verification.status
    payment.notes = verification.notes
    payment.verified_by = str(admin.id)
    payment.verified_at = datetime.utcnow()
    payment.updated_at = datetime.utcnow()
    
    await payment.save()
    
    # Update booking if payment completed
    if verification.status == PaymentStatus.COMPLETED:
        booking = await Booking.find_one(Booking.booking_id == payment.booking_id)
        if booking:
            booking.is_paid = True
            booking.payment_id = payment.payment_id
            booking.status = BookingStatus.PAYMENT_RECEIVED  # Payment verified, ready for admin to confirm
            booking.user_notified_payment = True
            booking.updated_at = datetime.utcnow()
            await booking.save()
            
            # Create notification for user
            notification = Notification(
                notification_id=generate_notification_id(),
                user_id=booking.user_id,
                user_email=booking.user_email,
                notification_type=NotificationType.PAYMENT_CONFIRMED,
                title="Payment Confirmed! ✅",
                message=f"Your payment of GH₵ {payment.amount} for booking #{booking.booking_id} has been verified. Your equipment will be delivered soon!",
                booking_id=booking.booking_id
            )
            await notification.insert()
    
    return {
        "message": f"Payment {verification.status}",
        "payment_id": payment.payment_id,
        "booking_id": payment.booking_id,
        "amount": f"GH₵ {payment.amount}",
        "verified_at": payment.verified_at.isoformat()
    }


@router.put("/bookings/{booking_id}/verify-payment", response_model=dict)
async def verify_booking_payment(
    booking_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Quick verify payment for a booking by booking ID
    Used by admin frontend for quick verification
    """
    try:
        # Find the booking
        booking = await Booking.find_one(Booking.booking_id == booking_id)
        
        if not booking:
            # Try by ObjectId
            try:
                from bson import ObjectId
                booking = await Booking.get(ObjectId(booking_id))
            except:
                pass
        
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check if already paid - prevent duplicate verification
        if booking.is_paid:
            return {
                "message": "Payment was already verified",
                "booking_id": booking.booking_id,
                "status": "already_verified"
            }
        
        # Find the payment
        payment = await Payment.find_one(Payment.booking_id == booking.booking_id)
        
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Payment record not found for this booking"
            )
        
        # Check if payment already completed - race condition protection
        if payment.status == PaymentStatus.COMPLETED:
            return {
                "message": "Payment was already verified",
                "booking_id": booking.booking_id,
                "status": "already_verified"
            }
        
        # Update payment as verified
        payment.status = PaymentStatus.COMPLETED
        payment.verified_by = str(admin.id)
        payment.verified_at = datetime.utcnow()
        payment.updated_at = datetime.utcnow()
        await payment.save()
        
        # Update booking
        booking.is_paid = True
        booking.payment_id = payment.payment_id
        booking.status = BookingStatus.PAYMENT_RECEIVED  # Payment verified, ready for admin to confirm
        booking.user_notified_payment = True
        booking.updated_at = datetime.utcnow()
        await booking.save()
        
        # Create notification for user
        try:
            notification = Notification(
                notification_id=generate_notification_id(),
                user_id=booking.user_id,
                user_email=booking.user_email,
                notification_type=NotificationType.PAYMENT_CONFIRMED,
                title="Payment Confirmed! ✅",
                message=f"Your payment of GH₵ {payment.amount} for booking #{booking.booking_id} has been verified. Your equipment will be delivered soon!",
                booking_id=booking.booking_id
            )
            await notification.insert()
        except Exception as e:
            # Log notification error but don't fail the payment verification
            print(f"Warning: Failed to create notification: {e}")
        
        return {
            "message": "Payment verified successfully",
            "booking_id": booking.booking_id,
            "payment_id": payment.payment_id,
            "amount": f"GH₵ {payment.amount}",
            "verified_at": payment.verified_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in verify_booking_payment: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error verifying payment: {str(e)}"
        )


@router.put("/bookings/{booking_id}/verify-extension", response_model=dict)
async def verify_extension_payment(
    booking_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Verify extension payment and apply the additional hours to the booking.
    This should be called after admin confirms the extension payment was received.
    
    This endpoint:
    1. Verifies the pending extension payment
    2. Adds the pending hours to extension_hours and total_hours
    3. Extends the end_time and actual_end_time
    4. Updates the booking status to EXTENDED
    5. Notifies the user that their extension was confirmed
    """
    # Find the booking
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Check if there's a pending extension
    if not booking.pending_extension_hours or booking.pending_extension_hours <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending extension found for this booking"
        )
    
    if not booking.pending_extension_payment_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending extension payment found"
        )
    
    # Find and verify the extension payment
    payment = await Payment.find_one(Payment.payment_id == booking.pending_extension_payment_id)
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Extension payment record not found"
        )
    
    # Update payment as verified
    payment.status = PaymentStatus.COMPLETED
    payment.verified_by = str(admin.id)
    payment.verified_at = datetime.utcnow()
    payment.updated_at = datetime.utcnow()
    await payment.save()
    
    # Now apply the extension to the booking
    pending_hours = booking.pending_extension_hours
    pending_amount = booking.pending_extension_amount
    
    booking.extension_hours += pending_hours
    booking.total_hours = booking.hours_booked + booking.extension_hours
    booking.extension_amount += pending_amount
    booking.total_amount = booking.base_amount + booking.extension_amount
    booking.end_time = booking.end_time + timedelta(hours=pending_hours)
    
    # Also update actual_end_time if session has started
    if booking.actual_end_time:
        booking.actual_end_time = booking.actual_end_time + timedelta(hours=pending_hours)
    
    # Update status - keep IN_USE (don't change to EXTENDED since session is still active)
    # EXTENDED is just a marker that extension happened, but status should remain IN_USE
    booking.extension_payment_id = payment.payment_id
    booking.pending_extension_hours = 0
    booking.pending_extension_amount = 0
    booking.pending_extension_payment_id = None
    booking.updated_at = datetime.utcnow()
    
    await booking.save()
    
    # Notify user that extension was confirmed
    notification = Notification(
        notification_id=generate_notification_id(),
        user_id=booking.user_id,
        user_email=booking.user_email,
        notification_type=NotificationType.SESSION_EXTENDED,
        title="Extension Confirmed! ⏰",
        message=f"Your {pending_hours} hour extension has been confirmed! New end time: {booking.actual_end_time.strftime('%I:%M %p') if booking.actual_end_time else booking.end_time.strftime('%I:%M %p')}. Enjoy your extra time!",
        booking_id=booking.booking_id
    )
    await notification.insert()
    
    return {
        "message": "Extension payment verified and hours added!",
        "booking_id": booking.booking_id,
        "extension_hours": pending_hours,
        "new_total_hours": booking.total_hours,
        "new_end_time": (booking.actual_end_time or booking.end_time).isoformat(),
        "new_total_amount": f"GH₵ {booking.total_amount}",
        "verified_at": payment.verified_at.isoformat()
    }


# ==================== USER MANAGEMENT ====================

@router.get("/users", response_model=List[UserResponse])
async def list_all_users(
    admin: User = Depends(get_current_admin_user)
):
    """
    List all registered users
    """
    users = await User.find_all().to_list()
    
    return [
        UserResponse(
            id=str(u.id),
            email=u.email,
            full_name=u.full_name,
            phone_number=u.phone_number,
            hostel_name=u.hostel_name,
            room_number=u.room_number,
            role=u.role,
            is_active=u.is_active,
            created_at=u.created_at
        )
        for u in users
    ]


@router.post("/create-admin", response_model=UserResponse)
async def create_admin_user(
    admin: User = Depends(get_current_admin_user)
):
    """
    Create another admin user (uses settings from .env)
    """
    # Check if admin already exists
    existing = await User.find_one(User.email == settings.admin_email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin user already exists"
        )
    
    admin_user = User(
        email=settings.admin_email,
        hashed_password=hash_password(settings.admin_password),
        full_name="System Admin",
        phone_number=settings.momo_number,
        hostel_name="Admin Office",
        room_number="N/A",
        role=UserRole.ADMIN,
        is_verified=True
    )
    
    await admin_user.insert()
    
    return UserResponse(
        id=str(admin_user.id),
        email=admin_user.email,
        full_name=admin_user.full_name,
        phone_number=admin_user.phone_number,
        hostel_name=admin_user.hostel_name,
        room_number=admin_user.room_number,
        role=admin_user.role,
        is_active=admin_user.is_active,
        created_at=admin_user.created_at
    )


# ==================== DASHBOARD / STATS ====================

@router.get("/dashboard")
async def get_dashboard_stats(
    admin: User = Depends(get_current_admin_user)
):
    """
    Get dashboard statistics
    """
    # Count totals
    total_users = await User.count()
    total_bookings = await Booking.count()
    total_equipment = await Equipment.count()
    
    # Active bookings
    active_bookings = await Booking.find(
        {"status": {"$in": [
            BookingStatus.PENDING,
            BookingStatus.PAYMENT_RECEIVED,
            BookingStatus.CONFIRMED,
            BookingStatus.DELIVERED,
            BookingStatus.IN_USE
        ]}}
    ).count()
    
    # Pending payments
    pending_payments = await Payment.find(
        {"status": {"$in": [PaymentStatus.PENDING, PaymentStatus.PROCESSING]}}
    ).count()
    
    # Available equipment
    available_equipment = await Equipment.find(
        Equipment.status == EquipmentStatus.AVAILABLE
    ).count()
    
    # Revenue calculation
    completed_payments = await Payment.find(
        Payment.status == PaymentStatus.COMPLETED
    ).to_list()
    total_revenue = sum(p.amount for p in completed_payments)
    
    # Recent bookings
    recent_bookings = await Booking.find_all().sort(-Booking.created_at).limit(5).to_list()
    
    return {
        "stats": {
            "total_users": total_users,
            "total_bookings": total_bookings,
            "active_bookings": active_bookings,
            "pending_payments": pending_payments,
            "total_equipment": total_equipment,
            "available_equipment": available_equipment,
            "total_revenue": f"GH₵ {total_revenue:,}"
        },
        "recent_bookings": [
            {
                "booking_id": b.booking_id,
                "customer": b.user_email,
                "equipment": b.equipment_name,
                "status": b.status,
                "amount": f"GH₵ {b.total_amount}"
            }
            for b in recent_bookings
        ]
    }


# ==================== ADMIN NOTIFICATIONS ====================

@router.get("/notifications", response_model=List[dict])
async def get_admin_notifications(
    unread_only: bool = Query(False),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all admin notifications (delivery confirmations, etc.)
    """
    query = {"is_admin_notification": True}
    if unread_only:
        query["is_read"] = False
    
    notifications = await Notification.find(query).sort(-Notification.created_at).limit(50).to_list()
    
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
async def mark_admin_notification_read(
    notification_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Mark an admin notification as read
    """
    notification = await Notification.find_one(Notification.notification_id == notification_id)
    
    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )
    
    notification.is_read = True
    notification.read_at = datetime.utcnow()
    await notification.save()
    
    return {"message": "Notification marked as read"}


# ==================== SETUP CONFIRMATION ====================

@router.get("/bookings/{booking_id}/photo")
async def get_booking_setup_photo(
    booking_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Get the setup photo uploaded by the user for a booking.
    Admin can view this to verify the setup before starting the timer.
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if not booking.delivery_photo_url:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No setup photo has been uploaded for this booking"
        )
    
    # Check if file exists
    if not os.path.exists(booking.delivery_photo_url):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Photo file not found"
        )
    
    return FileResponse(
        booking.delivery_photo_url,
        media_type="image/jpeg",
        filename=f"setup_{booking.booking_id}.jpg"
    )


@router.get("/bookings/{booking_id}/photo-url", response_model=dict)
async def get_booking_setup_photo_url(
    booking_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Get the URL/path to the setup photo for a booking.
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    if not booking.delivery_photo_url:
        return {"has_photo": False, "photo_url": None}
    
    return {
        "has_photo": True,
        "photo_url": f"/admin/bookings/{booking_id}/photo",
        "uploaded_at": booking.delivery_confirmed_at.isoformat() if booking.delivery_confirmed_at else None
    }


@router.post("/bookings/{booking_id}/confirm-setup", response_model=dict)
async def confirm_setup_and_start_timer(
    booking_id: str,
    admin: User = Depends(get_current_admin_user)
):
    """
    Admin confirms the setup photo and starts the gaming session timer.
    This should only be called AFTER reviewing the uploaded photo.
    
    This endpoint:
    1. Verifies the booking has a setup photo
    2. Sets the actual_start_time to now
    3. Calculates actual_end_time based on hours booked
    4. Changes status to IN_USE
    5. Notifies the user that their session has started
    """
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Can only confirm setup for bookings awaiting confirmation
    if booking.status != BookingStatus.AWAITING_CONFIRMATION:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot confirm setup. Booking status is '{booking.status}'. Expected 'awaiting_confirmation'"
        )
    
    # Make sure there's a photo uploaded
    if not booking.delivery_photo_url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot confirm setup - no photo has been uploaded by the user"
        )
    
    # Start the timer NOW
    now = datetime.utcnow()
    total_hours = booking.total_hours if booking.total_hours else booking.hours_booked
    
    booking.actual_start_time = now
    booking.actual_end_time = now + timedelta(hours=total_hours)
    booking.status = BookingStatus.IN_USE
    booking.updated_at = now
    
    # Update equipment status
    equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
    if equipment:
        equipment.status = EquipmentStatus.IN_USE
        await equipment.save()
    
    await booking.save()
    
    # Notify the user that their session has started
    user_notification = Notification(
        notification_id=generate_notification_id(),
        user_id=booking.user_id,
        user_email=booking.user_email,
        notification_type=NotificationType.SESSION_STARTED,
        title="Game On! 🎮 Your Session Has Started!",
        message=f"Admin has confirmed your setup! Your {total_hours}-hour gaming session has started. Timer ends at {booking.actual_end_time.strftime('%I:%M %p')}. Enjoy!",
        booking_id=booking.booking_id
    )
    await user_notification.insert()
    
    return {
        "message": "Setup confirmed! Timer has started.",
        "booking_id": booking.booking_id,
        "customer_email": booking.user_email,
        "session_start": booking.actual_start_time.isoformat(),
        "session_end": booking.actual_end_time.isoformat(),
        "hours": total_hours
    }


@router.get("/bookings/awaiting-confirmation", response_model=List[dict])
async def get_bookings_awaiting_confirmation(
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all bookings that have uploaded photos and are awaiting admin confirmation.
    These are bookings where the user has uploaded a setup photo but admin hasn't started the timer yet.
    """
    bookings = await Booking.find(
        Booking.status == BookingStatus.AWAITING_CONFIRMATION
    ).sort(-Booking.created_at).to_list()
    
    return [
        {
            "booking_id": b.booking_id,
            "user_email": b.user_email,
            "user_phone": b.user_phone,
            "equipment_name": b.equipment_name,
            "hostel_name": b.hostel_name,
            "room_number": b.room_number,
            "hours_booked": b.total_hours if b.total_hours else b.hours_booked,
            "photo_uploaded_at": b.delivery_confirmed_at.isoformat() if b.delivery_confirmed_at else None,
            "has_photo": bool(b.delivery_photo_url),
            "photo_url": f"/admin/bookings/{b.booking_id}/photo" if b.delivery_photo_url else None
        }
        for b in bookings
    ]


# ==================== PROMO CODE MANAGEMENT ====================

@router.post("/promo-codes", response_model=PromoCodeResponse, status_code=status.HTTP_201_CREATED)
async def create_promo_code(
    promo_data: PromoCodeCreate,
    admin: User = Depends(get_current_admin_user)
):
    """Create a new promo code"""
    existing = await PromoCode.find_one(PromoCode.code == promo_data.code.upper())
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Promo code already exists"
        )
    
    promo = PromoCode(
        code=promo_data.code.upper(),
        name=promo_data.name,
        description=promo_data.description,
        discount_type=promo_data.discount_type,
        discount_value=promo_data.discount_value,
        min_hours=promo_data.min_hours,
        max_discount=promo_data.max_discount,
        max_uses=promo_data.max_uses,
        max_uses_per_user=promo_data.max_uses_per_user,
        allowed_emails=promo_data.allowed_emails,
        first_booking_only=promo_data.first_booking_only,
        valid_from=promo_data.valid_from or datetime.utcnow(),
        valid_until=promo_data.valid_until,
        created_by=str(admin.id)
    )
    await promo.insert()
    
    return PromoCodeResponse(
        id=str(promo.id),
        code=promo.code,
        name=promo.name,
        description=promo.description,
        discount_type=promo.discount_type,
        discount_value=promo.discount_value,
        min_hours=promo.min_hours,
        max_discount=promo.max_discount,
        max_uses=promo.max_uses,
        current_uses=promo.current_uses,
        is_active=promo.is_active,
        valid_from=promo.valid_from,
        valid_until=promo.valid_until,
        created_at=promo.created_at
    )


@router.get("/promo-codes", response_model=List[PromoCodeResponse])
async def list_promo_codes(admin: User = Depends(get_current_admin_user)):
    """List all promo codes"""
    promos = await PromoCode.find_all().sort(-PromoCode.created_at).to_list()
    return [
        PromoCodeResponse(
            id=str(p.id), code=p.code, name=p.name, description=p.description,
            discount_type=p.discount_type, discount_value=p.discount_value,
            min_hours=p.min_hours, max_discount=p.max_discount,
            max_uses=p.max_uses, current_uses=p.current_uses,
            is_active=p.is_active, valid_from=p.valid_from,
            valid_until=p.valid_until, created_at=p.created_at
        )
        for p in promos
    ]


@router.put("/promo-codes/{code}/toggle")
async def toggle_promo_code(code: str, admin: User = Depends(get_current_admin_user)):
    """Enable or disable a promo code"""
    promo = await PromoCode.find_one(PromoCode.code == code.upper())
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    promo.is_active = not promo.is_active
    await promo.save()
    return {"code": promo.code, "is_active": promo.is_active}


@router.delete("/promo-codes/{code}")
async def delete_promo_code(code: str, admin: User = Depends(get_current_admin_user)):
    """Delete a promo code"""
    promo = await PromoCode.find_one(PromoCode.code == code.upper())
    if not promo:
        raise HTTPException(status_code=404, detail="Promo code not found")
    await promo.delete()
    return {"message": f"Promo code {code} deleted"}


# ==================== REVIEW MANAGEMENT ====================

@router.get("/reviews")
async def list_all_reviews(admin: User = Depends(get_current_admin_user)):
    """List all reviews for admin management"""
    reviews = await Review.find_all().sort(-Review.created_at).to_list()
    return [
        {
            "id": str(r.id), "review_id": r.review_id, "user_email": r.user_email,
            "user_name": r.user_name, "booking_id": r.booking_id,
            "equipment_name": r.equipment_name, "rating": r.rating,
            "title": r.title, "comment": r.comment,
            "admin_response": r.admin_response, "is_visible": r.is_visible,
            "is_featured": r.is_featured, "created_at": r.created_at.isoformat()
        }
        for r in reviews
    ]


@router.post("/reviews/{review_id}/respond")
async def respond_to_review(review_id: str, response_data: AdminReviewResponse, admin: User = Depends(get_current_admin_user)):
    """Admin responds to a review"""
    review = await Review.find_one(Review.review_id == review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.admin_response = response_data.response
    review.responded_at = datetime.utcnow()
    await review.save()
    return {"message": "Response added", "review_id": review.review_id}


@router.put("/reviews/{review_id}/toggle-visibility")
async def toggle_review_visibility(review_id: str, admin: User = Depends(get_current_admin_user)):
    """Show or hide a review"""
    review = await Review.find_one(Review.review_id == review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_visible = not review.is_visible
    await review.save()
    return {"review_id": review.review_id, "is_visible": review.is_visible}


@router.put("/reviews/{review_id}/toggle-featured")
async def toggle_review_featured(review_id: str, admin: User = Depends(get_current_admin_user)):
    """Feature or unfeature a review"""
    review = await Review.find_one(Review.review_id == review_id)
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    review.is_featured = not review.is_featured
    await review.save()
    return {"review_id": review.review_id, "is_featured": review.is_featured}
