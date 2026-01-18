"""
Review Routes
Submit and view ratings/reviews after completed sessions
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, HTTPException, status, Depends, Query
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.review import Review, ReviewCreate, ReviewResponse
from app.services.auth import get_current_user
from app.services.utils import generate_review_id


router = APIRouter(prefix="/reviews", tags=["Reviews"])


def format_privacy_name(full_name: str) -> str:
    """Format name for privacy: 'John Doe' -> 'John D.'"""
    if not full_name or not full_name.strip():
        return "Anonymous"
    parts = full_name.strip().split()
    if len(parts) == 1:
        return parts[0]
    # First name + last initial
    return f"{parts[0]} {parts[-1][0]}."


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
async def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(get_current_user)
):
    """
    Submit a review for a completed booking.
    
    Users can only review their own completed bookings, and only once per booking.
    """
    # Find the booking
    booking = await Booking.find_one(Booking.booking_id == review_data.booking_id)
    
    if not booking:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Booking not found"
        )
    
    # Verify ownership
    if booking.user_id != str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only review your own bookings"
        )
    
    # Verify booking is completed
    if booking.status != BookingStatus.COMPLETED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You can only review completed bookings"
        )
    
    # Check if already reviewed
    existing_review = await Review.find_one(Review.booking_id == review_data.booking_id)
    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this booking"
        )
    
    # Create review
    review = Review(
        review_id=generate_review_id(),
        user_id=str(current_user.id),
        user_email=current_user.email,
        user_name=current_user.full_name,
        booking_id=booking.booking_id,
        equipment_id=booking.equipment_id,
        equipment_name=booking.equipment_name,
        rating=review_data.rating,
        title=review_data.title,
        comment=review_data.comment,
        equipment_condition=review_data.equipment_condition,
        delivery_speed=review_data.delivery_speed,
        value_for_money=review_data.value_for_money
    )
    
    await review.insert()
    
    return ReviewResponse(
        id=str(review.id),
        review_id=review.review_id,
        user_name=review.user_name,
        equipment_name=review.equipment_name,
        rating=review.rating,
        title=review.title,
        comment=review.comment,
        equipment_condition=review.equipment_condition,
        delivery_speed=review.delivery_speed,
        value_for_money=review.value_for_money,
        admin_response=review.admin_response,
        is_featured=review.is_featured,
        created_at=review.created_at
    )


@router.get("/my-reviews", response_model=List[ReviewResponse])
async def get_my_reviews(
    current_user: User = Depends(get_current_user)
):
    """Get all reviews submitted by the current user"""
    reviews = await Review.find(
        Review.user_id == str(current_user.id)
    ).sort(-Review.created_at).to_list()
    
    return [
        ReviewResponse(
            id=str(r.id),
            review_id=r.review_id,
            user_name=r.user_name,
            equipment_name=r.equipment_name,
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            equipment_condition=r.equipment_condition,
            delivery_speed=r.delivery_speed,
            value_for_money=r.value_for_money,
            admin_response=r.admin_response,
            is_featured=r.is_featured,
            created_at=r.created_at
        )
        for r in reviews
    ]


@router.get("/equipment/{equipment_id}", response_model=List[ReviewResponse])
async def get_equipment_reviews(
    equipment_id: str,
    limit: int = Query(10, ge=1, le=50)
):
    """Get reviews for a specific equipment (public endpoint)"""
    reviews = await Review.find(
        Review.equipment_id == equipment_id,
        Review.is_visible == True
    ).sort(-Review.created_at).limit(limit).to_list()
    
    return [
        ReviewResponse(
            id=str(r.id),
            review_id=r.review_id,
            user_name=format_privacy_name(r.user_name),  # Privacy: "John D."
            equipment_name=r.equipment_name,
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            equipment_condition=r.equipment_condition,
            delivery_speed=r.delivery_speed,
            value_for_money=r.value_for_money,
            admin_response=r.admin_response,
            is_featured=r.is_featured,
            created_at=r.created_at
        )
        for r in reviews
    ]


@router.get("/stats/{equipment_id}")
async def get_equipment_rating_stats(equipment_id: str):
    """Get rating statistics for equipment"""
    reviews = await Review.find(
        Review.equipment_id == equipment_id,
        Review.is_visible == True
    ).to_list()
    
    if not reviews:
        return {
            "equipment_id": equipment_id,
            "total_reviews": 0,
            "average_rating": 0,
            "rating_breakdown": {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
        }
    
    total = len(reviews)
    avg_rating = sum(r.rating for r in reviews) / total
    
    breakdown = {"5": 0, "4": 0, "3": 0, "2": 0, "1": 0}
    for r in reviews:
        breakdown[str(r.rating)] += 1
    
    # Calculate category averages
    eq_ratings = [r.equipment_condition for r in reviews if r.equipment_condition]
    del_ratings = [r.delivery_speed for r in reviews if r.delivery_speed]
    val_ratings = [r.value_for_money for r in reviews if r.value_for_money]
    
    return {
        "equipment_id": equipment_id,
        "total_reviews": total,
        "average_rating": round(avg_rating, 1),
        "rating_breakdown": breakdown,
        "category_averages": {
            "equipment_condition": round(sum(eq_ratings) / len(eq_ratings), 1) if eq_ratings else None,
            "delivery_speed": round(sum(del_ratings) / len(del_ratings), 1) if del_ratings else None,
            "value_for_money": round(sum(val_ratings) / len(val_ratings), 1) if val_ratings else None
        }
    }


@router.get("/featured", response_model=List[ReviewResponse])
async def get_featured_reviews(limit: int = Query(5, ge=1, le=20)):
    """Get featured reviews for homepage display"""
    reviews = await Review.find(
        Review.is_featured == True,
        Review.is_visible == True
    ).sort(-Review.created_at).limit(limit).to_list()
    
    # If not enough featured, get top-rated reviews
    if len(reviews) < limit:
        additional = await Review.find(
            Review.is_visible == True,
            Review.rating >= 4
        ).sort(-Review.rating, -Review.created_at).limit(limit - len(reviews)).to_list()
        reviews.extend(additional)
    
    return [
        ReviewResponse(
            id=str(r.id),
            review_id=r.review_id,
            user_name=r.user_name.split()[0] + " " + r.user_name.split()[-1][0] + "." if len(r.user_name.split()) > 1 else r.user_name,
            equipment_name=r.equipment_name,
            rating=r.rating,
            title=r.title,
            comment=r.comment,
            equipment_condition=r.equipment_condition,
            delivery_speed=r.delivery_speed,
            value_for_money=r.value_for_money,
            admin_response=r.admin_response,
            is_featured=r.is_featured,
            created_at=r.created_at
        )
        for r in reviews
    ]


@router.get("/can-review/{booking_id}")
async def can_review_booking(
    booking_id: str,
    current_user: User = Depends(get_current_user)
):
    """Check if user can review a booking"""
    booking = await Booking.find_one(Booking.booking_id == booking_id)
    
    if not booking:
        return {"can_review": False, "reason": "Booking not found"}
    
    if booking.user_id != str(current_user.id):
        return {"can_review": False, "reason": "Not your booking"}
    
    if booking.status != BookingStatus.COMPLETED:
        return {"can_review": False, "reason": "Booking not completed yet"}
    
    existing = await Review.find_one(Review.booking_id == booking_id)
    if existing:
        return {"can_review": False, "reason": "Already reviewed", "review_id": existing.review_id}
    
    return {"can_review": True, "booking_id": booking_id}
