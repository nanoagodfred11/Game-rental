"""Routes package"""
from app.routes.auth import router as auth_router
from app.routes.bookings import router as bookings_router
from app.routes.payments import router as payments_router
from app.routes.admin import router as admin_router

__all__ = ["auth_router", "bookings_router", "payments_router", "admin_router"]
