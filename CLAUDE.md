# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a FastAPI backend for a PS5 gaming equipment rental service targeting hostel students in Ghana. The service handles equipment rentals with MTN Mobile Money payment integration.

## Development Commands

```bash
# Setup virtual environment
py -m venv venv
.\venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn main:app --reload

# Run with Python directly
py main.py

# Docker build and run
docker build -t gaming-rental .
docker run -p 8000:8000 --env-file .env gaming-rental
```

## Architecture

### Tech Stack
- **Framework**: FastAPI with Pydantic v2 for validation
- **Database**: MongoDB Atlas with Motor (async driver) and Beanie ODM
- **Authentication**: JWT tokens (python-jose, passlib/bcrypt)

### Application Structure
- `main.py` - Application entry point with FastAPI app, lifespan handler for startup/shutdown, background task for auto-completing expired sessions
- `app/config.py` - Pydantic Settings loading from `.env`
- `app/database.py` - MongoDB connection using Motor + Beanie ODM initialization

### Routes (app/routes/)
- `auth.py` - User registration, login, profile management
- `bookings.py` - Equipment booking CRUD, session extension
- `payments.py` - Payment instructions, confirmation, history
- `admin.py` - Dashboard, equipment management, payment verification
- `reviews.py` - Customer reviews
- `promo.py` - Promo code management
- `analytics.py` - Business analytics

### Models (app/models/)
All models extend Beanie `Document` for MongoDB persistence:
- `User` - with `UserRole` enum (CUSTOMER, ADMIN)
- `Equipment` - with `EquipmentStatus` enum
- `Booking` - with `BookingStatus` enum
- `Payment` - MTN MoMo transaction tracking
- `Review`, `PromoCode`, `Notification`

### Services (app/services/)
- `auth.py` - Password hashing, JWT token creation/verification
- `utils.py` - Shared utilities

## Key Patterns

- **Beanie ODM**: Models use `Document` base class, queries like `User.find_one()`, `Equipment.find().to_list()`
- **Startup seeding**: Default admin user and 2 PS5 equipment sets created on first run if not present
- **Background task**: Runs every 30 seconds to auto-complete expired sessions and clean up stale bookings
- **CORS**: Configured to allow all origins (development mode)

## Environment Variables

Copy `.env.example` to `.env`. Required variables:
- `MONGODB_URL` - MongoDB Atlas connection string
- `SECRET_KEY` - JWT signing key

Business settings are configurable via env vars: `HOURLY_RATE`, `MIN_BOOKING_HOURS`, `MAX_BOOKING_HOURS`, `MOMO_NUMBER`, `MOMO_NAME`.
