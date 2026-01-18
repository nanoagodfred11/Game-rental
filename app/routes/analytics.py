"""
Analytics Routes
Dashboard statistics and business analytics for admin
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, Query
from app.models.user import User
from app.models.booking import Booking, BookingStatus
from app.models.payment import Payment, PaymentStatus
from app.models.equipment import Equipment
from app.models.review import Review
from app.services.auth import get_current_admin_user


router = APIRouter(prefix="/admin/analytics", tags=["Analytics"])


@router.get("/dashboard")
async def get_dashboard_stats(
    admin: User = Depends(get_current_admin_user)
):
    """Get main dashboard statistics"""
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=now.weekday())
    month_start = today_start.replace(day=1)
    
    # Total counts
    total_bookings = await Booking.find_all().count()
    total_users = await User.find(User.role == "customer").count()
    total_equipment = await Equipment.find_all().count()
    
    # Revenue calculations
    completed_bookings = await Booking.find(
        Booking.status == BookingStatus.COMPLETED,
        Booking.is_paid == True
    ).to_list()
    
    total_revenue = sum(b.total_amount for b in completed_bookings)
    total_hours = sum(b.total_hours for b in completed_bookings)
    
    # Today's stats
    today_bookings = await Booking.find(
        Booking.created_at >= today_start
    ).to_list()
    today_revenue = sum(b.total_amount for b in today_bookings if b.is_paid)
    
    # This week's stats
    week_bookings = await Booking.find(
        Booking.created_at >= week_start
    ).to_list()
    week_revenue = sum(b.total_amount for b in week_bookings if b.is_paid)
    
    # This month's stats
    month_bookings = await Booking.find(
        Booking.created_at >= month_start
    ).to_list()
    month_revenue = sum(b.total_amount for b in month_bookings if b.is_paid)
    
    # Active sessions
    active_sessions = await Booking.find(
        {"status": {"$in": [BookingStatus.IN_USE, BookingStatus.DELIVERED]}}
    ).count()
    
    # Pending payments
    pending_payments = await Booking.find(
        Booking.is_paid == False,
        Booking.status == BookingStatus.PENDING
    ).count()
    
    # Average rating
    reviews = await Review.find(Review.is_visible == True).to_list()
    avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0
    
    return {
        "overview": {
            "total_bookings": total_bookings,
            "total_users": total_users,
            "total_equipment": total_equipment,
            "total_revenue": total_revenue,
            "total_hours_rented": total_hours,
            "average_rating": avg_rating,
            "total_reviews": len(reviews)
        },
        "today": {
            "bookings": len(today_bookings),
            "revenue": today_revenue,
            "active_sessions": active_sessions
        },
        "this_week": {
            "bookings": len(week_bookings),
            "revenue": week_revenue
        },
        "this_month": {
            "bookings": len(month_bookings),
            "revenue": month_revenue
        },
        "pending": {
            "payments": pending_payments,
            "active_sessions": active_sessions
        }
    }


@router.get("/revenue")
async def get_revenue_analytics(
    days: int = Query(30, ge=7, le=365),
    admin: User = Depends(get_current_admin_user)
):
    """Get revenue data for chart display"""
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)
    
    # Get completed bookings in date range
    bookings = await Booking.find(
        Booking.completed_at >= start_date,
        Booking.status == BookingStatus.COMPLETED,
        Booking.is_paid == True
    ).to_list()
    
    # Group by date
    daily_revenue = {}
    for b in bookings:
        # Skip bookings with null completed_at (data inconsistency)
        if not b.completed_at:
            continue
        date_key = b.completed_at.strftime("%Y-%m-%d")
        if date_key not in daily_revenue:
            daily_revenue[date_key] = {"revenue": 0, "bookings": 0, "hours": 0}
        daily_revenue[date_key]["revenue"] += b.total_amount or 0
        daily_revenue[date_key]["bookings"] += 1
        daily_revenue[date_key]["hours"] += b.total_hours or 0
    
    # Fill in missing dates
    chart_data = []
    current = start_date
    while current <= now:
        date_key = current.strftime("%Y-%m-%d")
        chart_data.append({
            "date": date_key,
            "label": current.strftime("%b %d"),
            "revenue": daily_revenue.get(date_key, {}).get("revenue", 0),
            "bookings": daily_revenue.get(date_key, {}).get("bookings", 0),
            "hours": daily_revenue.get(date_key, {}).get("hours", 0)
        })
        current += timedelta(days=1)
    
    # Summary stats
    total_revenue = sum(d["revenue"] for d in chart_data)
    total_bookings = sum(d["bookings"] for d in chart_data)
    avg_daily = total_revenue / days if days > 0 else 0
    
    return {
        "period_days": days,
        "chart_data": chart_data,
        "summary": {
            "total_revenue": total_revenue,
            "total_bookings": total_bookings,
            "average_daily_revenue": round(avg_daily, 2),
            "average_booking_value": round(total_revenue / total_bookings, 2) if total_bookings > 0 else 0
        }
    }


@router.get("/peak-hours")
async def get_peak_hours(
    days: int = Query(30, ge=7, le=90),
    admin: User = Depends(get_current_admin_user)
):
    """Get booking distribution by hour of day"""
    now = datetime.utcnow()
    start_date = now - timedelta(days=days)
    
    bookings = await Booking.find(
        Booking.created_at >= start_date
    ).to_list()
    
    # Count bookings by hour
    hourly_counts = {str(h): 0 for h in range(24)}
    for b in bookings:
        hour = str(b.start_time.hour)
        hourly_counts[hour] += 1
    
    # Find peak hours
    sorted_hours = sorted(hourly_counts.items(), key=lambda x: x[1], reverse=True)
    peak_hours = sorted_hours[:3]
    
    return {
        "period_days": days,
        "hourly_distribution": [
            {"hour": int(h), "label": f"{int(h):02d}:00", "bookings": c}
            for h, c in sorted(hourly_counts.items(), key=lambda x: int(x[0]))
        ],
        "peak_hours": [
            {"hour": int(h), "label": f"{int(h):02d}:00", "bookings": c}
            for h, c in peak_hours
        ],
        "insights": {
            "busiest_hour": f"{int(peak_hours[0][0]):02d}:00" if peak_hours else None,
            "quietest_hour": f"{int(sorted_hours[-1][0]):02d}:00" if sorted_hours else None
        }
    }


@router.get("/equipment-performance")
async def get_equipment_performance(
    admin: User = Depends(get_current_admin_user)
):
    """Get performance metrics for each equipment"""
    equipment_list = await Equipment.find_all().to_list()
    
    performance = []
    for eq in equipment_list:
        # Get bookings for this equipment
        bookings = await Booking.find(
            Booking.equipment_id == eq.equipment_id,
            Booking.status == BookingStatus.COMPLETED
        ).to_list()
        
        # Get reviews
        reviews = await Review.find(
            Review.equipment_id == eq.equipment_id,
            Review.is_visible == True
        ).to_list()
        
        total_revenue = sum(b.total_amount for b in bookings)
        total_hours = sum(b.total_hours for b in bookings)
        avg_rating = round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0
        
        performance.append({
            "equipment_id": eq.equipment_id,
            "name": eq.name,
            "status": eq.status,
            "total_bookings": len(bookings),
            "total_hours": total_hours,
            "total_revenue": total_revenue,
            "average_rating": avg_rating,
            "review_count": len(reviews)
        })
    
    # Sort by revenue
    performance.sort(key=lambda x: x["total_revenue"], reverse=True)
    
    return {
        "equipment_count": len(equipment_list),
        "equipment": performance,
        "top_performer": performance[0] if performance else None
    }


@router.get("/user-stats")
async def get_user_statistics(
    admin: User = Depends(get_current_admin_user)
):
    """Get user statistics and top customers"""
    users = await User.find(User.role == "customer").to_list()
    
    user_stats = []
    for user in users:
        bookings = await Booking.find(
            Booking.user_id == str(user.id),
            Booking.status == BookingStatus.COMPLETED
        ).to_list()
        
        if bookings:
            total_spent = sum(b.total_amount for b in bookings)
            total_hours = sum(b.total_hours for b in bookings)
            
            user_stats.append({
                "user_id": str(user.id),
                "email": user.email,
                "name": user.full_name,
                "total_bookings": len(bookings),
                "total_spent": total_spent,
                "total_hours": total_hours,
                "member_since": user.created_at.isoformat()
            })
    
    # Sort by total spent
    user_stats.sort(key=lambda x: x["total_spent"], reverse=True)
    
    return {
        "total_customers": len(users),
        "active_customers": len(user_stats),
        "top_customers": user_stats[:10],
        "new_this_month": len([u for u in users if u.created_at >= datetime.utcnow().replace(day=1)])
    }
