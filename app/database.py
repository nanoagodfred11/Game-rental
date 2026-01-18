"""
MongoDB Database Connection
Uses Motor (async MongoDB driver) with Beanie ODM
"""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.config import settings


# Database client instance
client: AsyncIOMotorClient = None


async def connect_to_database():
    """Initialize database connection and Beanie ODM"""
    global client
    
    # Import models here to avoid circular imports
    from app.models.user import User
    from app.models.equipment import Equipment
    from app.models.booking import Booking
    from app.models.payment import Payment
    from app.models.notification import Notification
    from app.models.review import Review
    from app.models.promo import PromoCode
    
    # Create MongoDB client
    client = AsyncIOMotorClient(settings.mongodb_url)
    
    # Initialize Beanie with document models
    await init_beanie(
        database=client[settings.database_name],
        document_models=[User, Equipment, Booking, Payment, Notification, Review, PromoCode]
    )
    
    print(f"[+] Connected to MongoDB: {settings.database_name}")


async def close_database_connection():
    """Close database connection"""
    global client
    if client:
        client.close()
        print("[*] Database connection closed")
