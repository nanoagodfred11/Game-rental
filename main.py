"""
Gaming Rental Service - Main Application Entry Point
FastAPI backend for PS5 rental business
"""
import asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_to_database, close_database_connection
from app.routes import auth_router, bookings_router, payments_router, admin_router
from app.routes.reviews import router as reviews_router
from app.routes.promo import router as promo_router
from app.routes.analytics import router as analytics_router
from app.models.user import User, UserRole
from app.models.equipment import Equipment, EquipmentStatus
from app.models.booking import Booking, BookingStatus
from app.models.review import Review
from app.models.promo import PromoCode
from app.services.auth import hash_password
from app.config import settings


# Background task control
background_task = None
stop_background_task = False


async def auto_complete_expired_sessions():
    """Background task to automatically complete expired sessions"""
    global stop_background_task
    print("[*] Background task started: Auto-complete expired sessions")

    while not stop_background_task:
        try:
            now = datetime.utcnow()

            # Find all in_use or extended bookings that have expired
            expired_bookings = await Booking.find(
                {
                    "status": {"$in": ["in_use", "extended"]},
                    "actual_end_time": {"$lt": now}
                }
            ).to_list()

            for booking in expired_bookings:
                print(f"[*] Auto-completing expired session: {booking.booking_id}")

                # Update booking to completed
                booking.status = BookingStatus.COMPLETED
                booking.completed_at = now
                booking.updated_at = now
                await booking.save()

                # Free up equipment
                equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
                if equipment:
                    equipment.status = EquipmentStatus.AVAILABLE
                    equipment.current_booking_id = None
                    equipment.total_hours_rented += booking.total_hours if booking.total_hours else booking.hours_booked
                    equipment.total_revenue += booking.total_amount
                    await equipment.save()
                    print(f"[+] Equipment {equipment.equipment_id} is now AVAILABLE")

            # Also handle stale "delivered" or "awaiting_confirmation" bookings
            # If a booking has been in "delivered" status for more than 24 hours without
            # being confirmed, it's likely stuck and should be auto-cancelled
            stale_cutoff = now - timedelta(hours=24)
            stale_bookings = await Booking.find(
                {
                    "status": {"$in": ["delivered", "awaiting_confirmation"]},
                    "delivered_at": {"$lt": stale_cutoff}
                }
            ).to_list()

            for booking in stale_bookings:
                print(f"[*] Auto-cancelling stale delivered booking: {booking.booking_id}")
                booking.status = BookingStatus.CANCELLED
                booking.cancelled_at = now
                booking.admin_notes = (booking.admin_notes or "") + " [Auto-cancelled: stale delivery status]"
                booking.updated_at = now
                await booking.save()

                # Free up equipment
                equipment = await Equipment.find_one(Equipment.equipment_id == booking.equipment_id)
                if equipment and equipment.current_booking_id == booking.booking_id:
                    equipment.status = EquipmentStatus.AVAILABLE
                    equipment.current_booking_id = None
                    await equipment.save()
                    print(f"[+] Equipment {equipment.equipment_id} freed from stale booking")

        except Exception as e:
            print(f"[!] Error in auto-complete task: {e}")

        # Check every 30 seconds
        await asyncio.sleep(30)

    print("[*] Background task stopped")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Handle startup and shutdown events"""
    global background_task, stop_background_task
    
    # Startup
    print("[*] Starting Gaming Rental Service...")
    await connect_to_database()

    # Create default admin user if not exists
    existing_admin = await User.find_one(User.email == settings.admin_email)
    if not existing_admin:
        admin = User(
            email=settings.admin_email,
            hashed_password=hash_password(settings.admin_password),
            full_name="System Admin",
            phone_number=settings.momo_number,
            hostel_name="Admin Office",
            room_number="N/A",
            role=UserRole.ADMIN,
            is_verified=True
        )
        await admin.insert()
        print(f"[+] Default admin created: {settings.admin_email}")

    # Create default equipment if none exists
    equipment_count = await Equipment.count()
    if equipment_count == 0:
        # Create 2 PS5 sets as specified
        for i in range(1, 3):
            equipment = Equipment(
                name=f"PS5 Gaming Set {i}",
                equipment_id=f"PS5-{i:03d}",
                description="PlayStation 5 with 32-inch TV and 2 DualSense controllers",
                components=[
                    "PlayStation 5 Console",
                    "32-inch LED TV",
                    "2 DualSense Wireless Controllers",
                    "HDMI Cable",
                    "Power Extension"
                ],
                hourly_rate=settings.hourly_rate
            )
            await equipment.insert()
            print(f"[+] Created equipment: {equipment.name}")

    print("[*] Server ready!")
    print(f"[*] API Docs: http://localhost:8000/docs")
    print(f"[*] Hourly Rate: GHS {settings.hourly_rate}")
    print(f"[*] MoMo: {settings.momo_number} ({settings.momo_name})")
    
    # Start background task for auto-completing expired sessions
    stop_background_task = False
    background_task = asyncio.create_task(auto_complete_expired_sessions())
    
    yield
    
    # Shutdown
    stop_background_task = True
    if background_task:
        background_task.cancel()
        try:
            await background_task
        except asyncio.CancelledError:
            pass
    await close_database_connection()
    print("[*] Server stopped")


# Create FastAPI application
app = FastAPI(
    title="Gaming Rental Service API",
    description="""
    ## 🎮 PS5 Gaming Equipment Rental Service
    
    Rent PlayStation 5 gaming sets delivered and set up at your hostel room!
    
    ### Features:
    - **Book** PS5 + TV gaming sets for 2-6 hours
    - **Pay** via MTN Mobile Money
    - **Extend** your session if you want more time
    - **24/7** availability
    
    ### Pricing:
    - **GH₵ 70 per hour**
    - **Minimum**: 2 hours (GH₵ 200)
    - **Maximum**: 6 hours (GH₵ 600)
    
    ### How it works:
    1. Register/Login to your account
    2. Check available equipment
    3. Book your preferred time slot
    4. Pay via MTN Mobile Money
    5. We deliver and set up at your room
    6. Play and enjoy!
    7. Extend if needed (pay for extra hours)
    8. We pick up when you're done
    
    ### Payment:
    - **MTN MoMo Number**: 0592005318
    - **Name**: NANOA GODFRED
    """,
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware (allow all origins for development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(bookings_router)
app.include_router(payments_router)
app.include_router(admin_router)
app.include_router(reviews_router)
app.include_router(promo_router)
app.include_router(analytics_router)


@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint"""
    return {
        "service": "Gaming Rental Service API",
        "status": "running",
        "version": "1.0.0",
        "pricing": {
            "hourly_rate": f"GH₵ {settings.hourly_rate}",
            "min_hours": settings.min_booking_hours,
            "max_hours": settings.max_booking_hours
        },
        "payment": {
            "method": "MTN Mobile Money",
            "number": settings.momo_number,
            "name": settings.momo_name
        },
        "docs": "/docs"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check"""
    try:
        # Check database connection
        user_count = await User.count()
        equipment_count = await Equipment.count()
        
        return {
            "status": "healthy",
            "database": "connected",
            "users": user_count,
            "equipment": equipment_count
        }
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Service unhealthy: {str(e)}"
        )


# Run with: uvicorn main:app --reload
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
