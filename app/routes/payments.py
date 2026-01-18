"""
Payment Routes
Handle MTN Mobile Money payment confirmation and tracking
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.models.user import User, UserRole
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus, PaymentType, PaymentResponse, PaymentConfirm, PaymentInstructions
from app.services.auth import get_current_user
from app.config import settings


router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/instructions/{booking_id}", response_model=PaymentInstructions)
async def get_payment_instructions(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get payment instructions for a booking
    
    - **booking_id**: Your booking ID (e.g., BK-20251230-A1B2)
    """
    # Find payment
    payment = await Payment.find_one(
        Payment.booking_id == booking_id,
        Payment.status == PaymentStatus.PENDING
    )
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending payment found for this booking"
        )
    
    if payment.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment"
        )
    
    return PaymentInstructions(
        payment_id=payment.payment_id,
        booking_id=payment.booking_id,
        amount=payment.amount,
        currency=payment.currency,
        momo_number=settings.momo_number,
        momo_name=settings.momo_name,
        instructions=[
            "1. Open MTN Mobile Money (dial *170# or use the app)",
            "2. Select 'Send Money' / 'Transfer to MoMo'",
            f"3. Enter this number: {settings.momo_number}",
            f"4. Name will show: {settings.momo_name}",
            f"5. Enter amount: GH₵ {payment.amount}",
            f"6. Use reference: {payment.booking_id}",
            "7. Confirm and note down your Transaction ID",
            "8. Come back here and confirm your payment"
        ],
        important_notes=[
            "⚠️ Payment must be completed before equipment delivery",
            "⚠️ Save your MoMo Transaction ID - you'll need it to confirm",
            "⚠️ Double-check the amount before confirming",
            f"📞 Questions? Contact: {settings.momo_number}"
        ]
    )


@router.post("/confirm/{payment_id}", response_model=dict)
async def confirm_payment(
    payment_id: str,
    confirmation: PaymentConfirm,
    current_user: User = Depends(get_current_user)
):
    """
    Confirm that you've made the MoMo payment
    
    - **momo_number_from**: The phone number you sent from
    - **momo_transaction_id**: The MoMo transaction reference/ID
    
    After confirmation, admin will verify and update your booking status.
    """
    # Find payment
    payment = await Payment.find_one(Payment.payment_id == payment_id)
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    if payment.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to confirm this payment"
        )
    
    if payment.status != PaymentStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Payment is already {payment.status}"
        )
    
    # Update payment with confirmation details
    payment.momo_number_from = confirmation.momo_number_from
    payment.momo_transaction_id = confirmation.momo_transaction_id
    payment.status = PaymentStatus.PROCESSING
    payment.updated_at = datetime.utcnow()
    
    await payment.save()
    
    return {
        "message": "Payment confirmation received! Awaiting admin verification.",
        "payment_id": payment.payment_id,
        "booking_id": payment.booking_id,
        "amount": f"GH₵ {payment.amount}",
        "status": payment.status,
        "transaction_id": confirmation.momo_transaction_id,
        "next_steps": [
            "✅ Your payment is being verified",
            "⏳ You'll receive a confirmation once verified",
            "🎮 After verification, we'll deliver and set up your gaming equipment"
        ]
    }


@router.get("/my-payments", response_model=List[PaymentResponse])
async def get_my_payments(
    status_filter: Optional[PaymentStatus] = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user)
):
    """
    Get all your payment history
    """
    query = Payment.find(Payment.user_id == str(current_user.id))
    
    if status_filter:
        query = Payment.find(
            Payment.user_id == str(current_user.id),
            Payment.status == status_filter
        )
    
    payments = await query.sort(-Payment.created_at).to_list()
    
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


@router.get("/{payment_id}", response_model=PaymentResponse)
async def get_payment(
    payment_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Get details of a specific payment
    """
    payment = await Payment.find_one(Payment.payment_id == payment_id)
    
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment not found"
        )
    
    if payment.user_id != str(current_user.id) and current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this payment"
        )
    
    return PaymentResponse(
        id=str(payment.id),
        payment_id=payment.payment_id,
        booking_id=payment.booking_id,
        payment_type=payment.payment_type,
        amount=payment.amount,
        currency=payment.currency,
        momo_number_to=payment.momo_number_to,
        momo_name_to=payment.momo_name_to,
        status=payment.status,
        momo_transaction_id=payment.momo_transaction_id,
        created_at=payment.created_at,
        verified_at=payment.verified_at
    )
