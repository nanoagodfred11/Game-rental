"""
Authentication Routes
User registration, login, and profile management
"""
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException, status, Depends
from app.models.user import User, UserCreate, UserLogin, UserResponse, UserUpdate, Token, UserRole
from app.services.auth import (
    hash_password, 
    verify_password, 
    create_access_token, 
    get_current_user
)
from app.config import settings


router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate):
    """
    Register a new user account
    
    - **email**: Valid email address
    - **password**: Minimum 6 characters
    - **full_name**: Your full name
    - **phone_number**: Your phone number (for MoMo and delivery contact)
    - **hostel_name**: Name of your hostel
    - **room_number**: Your room number
    """
    # Check if email already exists
    existing_user = await User.find_one(User.email == user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    user = User(
        email=user_data.email,
        hashed_password=hash_password(user_data.password),
        full_name=user_data.full_name,
        phone_number=user_data.phone_number,
        hostel_name=user_data.hostel_name,
        room_number=user_data.room_number,
        role=UserRole.CUSTOMER
    )
    
    await user.insert()
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            phone_number=user.phone_number,
            hostel_name=user.hostel_name,
            room_number=user.room_number,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )


@router.post("/login", response_model=Token)
async def login(credentials: UserLogin):
    """
    Login to your account
    
    - **email**: Your registered email
    - **password**: Your password
    """
    # Find user by email
    user = await User.find_one(User.email == credentials.email)
    
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(user.id), "email": user.email, "role": user.role}
    )
    
    return Token(
        access_token=access_token,
        user=UserResponse(
            id=str(user.id),
            email=user.email,
            full_name=user.full_name,
            phone_number=user.phone_number,
            hostel_name=user.hostel_name,
            room_number=user.room_number,
            role=user.role,
            is_active=user.is_active,
            created_at=user.created_at
        )
    )


@router.get("/me", response_model=UserResponse)
async def get_profile(current_user: User = Depends(get_current_user)):
    """
    Get current user's profile
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        phone_number=current_user.phone_number,
        hostel_name=current_user.hostel_name,
        room_number=current_user.room_number,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )


@router.put("/me", response_model=UserResponse)
async def update_profile(
    update_data: UserUpdate,
    current_user: User = Depends(get_current_user)
):
    """
    Update current user's profile
    
    You can update:
    - **full_name**
    - **phone_number**
    - **hostel_name**
    - **room_number**
    """
    # Update fields if provided
    if update_data.full_name:
        current_user.full_name = update_data.full_name
    if update_data.phone_number:
        current_user.phone_number = update_data.phone_number
    if update_data.hostel_name:
        current_user.hostel_name = update_data.hostel_name
    if update_data.room_number:
        current_user.room_number = update_data.room_number
    
    current_user.updated_at = datetime.utcnow()
    await current_user.save()
    
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        full_name=current_user.full_name,
        phone_number=current_user.phone_number,
        hostel_name=current_user.hostel_name,
        room_number=current_user.room_number,
        role=current_user.role,
        is_active=current_user.is_active,
        created_at=current_user.created_at
    )
