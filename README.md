# Gaming Rental Service - Backend API

🎮 A FastAPI backend for renting PS5 gaming equipment to hostel students in Ghana.

## Features

- **User Management**: Registration, login, profile management
- **Equipment Inventory**: Track PS5 + TV sets
- **Booking System**: Reserve equipment for 2-6 hours
- **Payment Integration**: MTN Mobile Money tracking
- **Admin Dashboard**: Manage bookings, verify payments, track revenue

## Tech Stack

- **Framework**: FastAPI (Python)
- **Database**: MongoDB Atlas
- **Authentication**: JWT tokens
- **Payment**: MTN Mobile Money (manual verification)

## Quick Start

### 1. Prerequisites

- Python 3.10+
- MongoDB Atlas account (free tier works)

### 2. Setup

```bash
# Create virtual environment
py -m venv venv

# Activate virtual environment (Windows)
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

1. Copy `.env.example` to `.env`
2. Update the MongoDB connection string:
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create a free cluster
   - Get your connection string
   - Replace in `.env`

```env
MONGODB_URL=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@cluster.mongodb.net/gaming_rental
SECRET_KEY=your-random-secret-key
```

### 4. Run the Server

```bash
# Development mode with auto-reload
uvicorn main:app --reload

# Or
py main.py
```

### 5. Access the API

- **API Docs**: http://localhost:8000/docs
- **Alternative Docs**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login user |
| GET | `/auth/me` | Get current user profile |
| PUT | `/auth/me` | Update profile |

### Bookings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/bookings/available` | List available equipment |
| POST | `/bookings/` | Create new booking |
| GET | `/bookings/my-bookings` | Get user's bookings |
| GET | `/bookings/{booking_id}` | Get booking details |
| POST | `/bookings/{booking_id}/extend` | Extend session |
| POST | `/bookings/{booking_id}/cancel` | Cancel booking |

### Payments
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/payments/instructions/{booking_id}` | Get payment instructions |
| POST | `/payments/confirm/{payment_id}` | Confirm payment made |
| GET | `/payments/my-payments` | Get payment history |

### Admin
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin/dashboard` | Dashboard statistics |
| POST | `/admin/equipment` | Add equipment |
| GET | `/admin/equipment` | List all equipment |
| GET | `/admin/bookings` | List all bookings |
| PUT | `/admin/bookings/{id}/status` | Update booking status |
| GET | `/admin/payments/pending` | List pending payments |
| POST | `/admin/payments/{id}/verify` | Verify payment |

## Business Settings

| Setting | Value |
|---------|-------|
| Hourly Rate | GH₵ 100 |
| Minimum Booking | 2 hours |
| Maximum Booking | 6 hours |
| Currency | Ghana Cedis (GHS) |
| Payment Method | MTN Mobile Money |

## Default Admin Credentials

```
Email: admin@gamingservice.com
Password: admin123456
```

⚠️ **Change these in production!**

## Payment Flow

1. Customer creates booking
2. System generates payment instructions
3. Customer pays via MTN MoMo to: **0592005318** (NANOA GODFRED)
4. Customer submits transaction ID
5. Admin verifies in MoMo history
6. Booking confirmed → Equipment delivered

## Project Structure

```
startup1/
├── main.py                 # Application entry point
├── requirements.txt        # Python dependencies
├── .env                    # Environment variables
├── .env.example           # Example environment file
├── README.md              # This file
└── app/
    ├── __init__.py
    ├── config.py          # Settings configuration
    ├── database.py        # MongoDB connection
    ├── models/            # Database models
    │   ├── user.py
    │   ├── equipment.py
    │   ├── booking.py
    │   └── payment.py
    ├── routes/            # API endpoints
    │   ├── auth.py
    │   ├── bookings.py
    │   ├── payments.py
    │   └── admin.py
    └── services/          # Business logic
        ├── auth.py
        └── utils.py
```

## Support

For issues or questions, contact: 0592005318

---

Built with ❤️ for Ghana's gaming community
