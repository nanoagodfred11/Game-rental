"""
Promo Code Routes
Validate and apply promotional discount codes
"""
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.promo import (
    PromoCode, PromoCodeCreate, PromoCodeResponse, 
    PromoCodeValidate, PromoCodeApplyResult, DiscountType
)
from app.services.auth import get_current_user
from app.config import settings


router = APIRouter(prefix="/promo", tags=["Promo Codes"])


def calculate_discount(promo: PromoCode, hours: int, hourly_rate: int) -> tuple:
    """Calculate discount amount and final price"""
    original_amount = hours * hourly_rate
    discount_amount = 0
    description = ""
    
    if promo.discount_type == DiscountType.PERCENTAGE:
        discount_amount = int(original_amount * promo.discount_value / 100)
        if promo.max_discount and discount_amount > promo.max_discount:
            discount_amount = promo.max_discount
        description = f"{promo.discount_value}% off"
    
    elif promo.discount_type == DiscountType.FIXED:
        discount_amount = min(promo.discount_value, original_amount)
        description = f"GH₵{promo.discount_value} off"
    
    elif promo.discount_type == DiscountType.FREE_HOURS:
        free_hours = min(promo.discount_value, hours - 1)  # At least 1 hour must be paid
        discount_amount = free_hours * hourly_rate
        description = f"{promo.discount_value} free hour{'s' if promo.discount_value > 1 else ''}"
    
    final_amount = original_amount - discount_amount
    return discount_amount, final_amount, description


@router.post("/validate", response_model=PromoCodeApplyResult)
async def validate_promo_code(
    data: PromoCodeValidate,
    current_user: User = Depends(get_current_user)
):
    """
    Validate a promo code and calculate discount.
    
    Does not apply the code - just checks validity and shows potential savings.
    """
    code = data.code.upper().strip()
    
    # Find promo code
    promo = await PromoCode.find_one(PromoCode.code == code)
    
    if not promo:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="Invalid promo code",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check if active
    if not promo.is_active:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="This promo code is no longer active",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check validity period
    now = datetime.utcnow()
    if now < promo.valid_from:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message=f"This code is not yet valid. Starts {promo.valid_from.strftime('%b %d, %Y')}",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    if promo.valid_until and now > promo.valid_until:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="This promo code has expired",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check usage limits
    if promo.max_uses and promo.current_uses >= promo.max_uses:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="This promo code has reached its usage limit",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check per-user limit
    user_uses = promo.used_by.count(str(current_user.id))
    if user_uses >= promo.max_uses_per_user:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="You have already used this promo code",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check minimum hours
    if data.hours < promo.min_hours:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message=f"Minimum {promo.min_hours} hours required for this code",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check email restrictions
    if promo.allowed_emails and current_user.email not in promo.allowed_emails:
        return PromoCodeApplyResult(
            valid=False,
            code=code,
            message="This promo code is not available for your account",
            discount_amount=0,
            original_amount=data.hours * settings.hourly_rate,
            final_amount=data.hours * settings.hourly_rate
        )
    
    # Check first booking only - only count completed bookings (not pending/cancelled ones)
    if promo.first_booking_only:
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
            return PromoCodeApplyResult(
                valid=False,
                code=code,
                message="This code is only for first-time customers",
                discount_amount=0,
                original_amount=data.hours * settings.hourly_rate,
                final_amount=data.hours * settings.hourly_rate
            )
    
    # Calculate discount
    discount_amount, final_amount, description = calculate_discount(
        promo, data.hours, settings.hourly_rate
    )
    
    return PromoCodeApplyResult(
        valid=True,
        code=code,
        message=f"🎉 {promo.name} applied! You save GH₵{discount_amount}",
        discount_amount=discount_amount,
        original_amount=data.hours * settings.hourly_rate,
        final_amount=final_amount,
        discount_description=description
    )


@router.get("/active", response_model=List[dict])
async def get_active_promos(
    current_user: User = Depends(get_current_user)
):
    """
    Get list of active promo codes available to the current user.
    Shows public codes plus any codes specifically allowed for this user's email.
    """
    now = datetime.utcnow()

    # Find all active, currently valid promo codes
    all_promos = await PromoCode.find(
        PromoCode.is_active == True,
        PromoCode.valid_from <= now,
    ).to_list()

    # Filter to codes that are:
    # 1. Still valid (not expired)
    # 2. Either public (no email restrictions) OR user's email is in allowed list
    available_promos = []
    for p in all_promos:
        # Check expiration
        if p.valid_until and now > p.valid_until:
            continue
        # Check usage limits
        if p.max_uses and p.current_uses >= p.max_uses:
            continue
        # Check if public or user is allowed
        if p.allowed_emails and current_user.email not in p.allowed_emails:
            continue
        available_promos.append(p)

    return [
        {
            "code": p.code,
            "name": p.name,
            "description": p.description or f"Get {p.discount_value}{'%' if p.discount_type == DiscountType.PERCENTAGE else ' GH₵'} off!",
            "discount_type": p.discount_type,
            "discount_value": p.discount_value,
            "min_hours": p.min_hours,
            "valid_until": p.valid_until.isoformat() if p.valid_until else None,
            "first_booking_only": p.first_booking_only
        }
        for p in available_promos
    ]
