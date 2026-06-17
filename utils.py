# utils.py
# توابع کمکی برای مدیریت زمان تهران و سایر ابزارها

from datetime import datetime, timedelta
import pytz

# منطقه زمانی ایران (تهران)
IRAN_TZ = pytz.timezone('Asia/Tehran')

def get_current_tehran_time():
    """دریافت زمان فعلی تهران (datetime آگاه از منطقه زمانی)"""
    utc_now = datetime.utcnow()
    # تبدیل UTC به تهران
    tehran_time = utc_now.replace(tzinfo=pytz.utc).astimezone(IRAN_TZ)
    return tehran_time

def get_current_tehran_naive():
    """دریافت زمان فعلی تهران بدون اطلاعات منطقه زمانی (برای ذخیره در دیتابیس)"""
    return get_current_tehran_time().replace(tzinfo=None)

def convert_to_tehran_time(utc_datetime):
    """تبدیل زمان UTC به تهران (برای داده‌های قدیمی)"""
    if utc_datetime is None:
        return None
    # اگر timezone-aware نبود، فرض می‌کنیم UTC است
    if utc_datetime.tzinfo is None:
        utc_datetime = utc_datetime.replace(tzinfo=pytz.utc)
    return utc_datetime.astimezone(IRAN_TZ)

def get_tehran_now_str(format_str='%Y-%m-%d %H:%M:%S'):
    """دریافت زمان تهران به صورت رشته فرمت شده"""
    return get_current_tehran_naive().strftime(format_str)

def get_tehran_time_from_utc_string(utc_str):
    """تبدیل رشته UTC به زمان تهران (برای JSON)"""
    try:
        utc_dt = datetime.fromisoformat(utc_str.replace('Z', '+00:00'))
        return convert_to_tehran_time(utc_dt)
    except:
        return None