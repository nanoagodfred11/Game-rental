"""
Utility functions for ID generation and helpers
"""
from datetime import datetime
import random
import string


def generate_booking_id() -> str:
    """Generate a unique booking ID like BK-20251230-A1B2"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"BK-{date_part}-{random_part}"


def generate_payment_id() -> str:
    """Generate a unique payment ID like PAY-20251230-C3D4"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"PAY-{date_part}-{random_part}"


def generate_equipment_id(number: int) -> str:
    """Generate equipment ID like PS5-001"""
    return f"PS5-{number:03d}"


def generate_notification_id() -> str:
    """Generate a unique notification ID like NOTIF-20251230-E5F6"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"NOTIF-{date_part}-{random_part}"


def generate_review_id() -> str:
    """Generate a unique review ID like REV-20260106-G7H8"""
    date_part = datetime.utcnow().strftime("%Y%m%d")
    random_part = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
    return f"REV-{date_part}-{random_part}"


def format_currency(amount: int, currency: str = "GHS") -> str:
    """Format amount with currency symbol"""
    if currency == "GHS":
        return f"GH₵ {amount:,}"
    return f"{currency} {amount:,}"


def calculate_booking_amount(hours: int, hourly_rate: int) -> int:
    """Calculate total booking amount"""
    return hours * hourly_rate
