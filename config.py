# config.py
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# ==================== دیتابیس ====================
# اولویت با DATABASE_URL (برای Vercel + Supabase)
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
else:
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "instance", "farm.db")}'

SQLALCHEMY_TRACK_MODIFICATIONS = False

# ==================== Supabase (برای استفاده مستقیم) ====================
SUPABASE_URL = os.environ.get('SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_KEY')

# ==================== امنیت ====================
SECRET_KEY = os.environ.get('SECRET_KEY', 'smart-agriculture-secret-key-2025-change-in-production')

# ==================== بقیه تنظیمات (بدون تغییر) ====================
DEVICE_CODES_DB_PATH = os.path.join(BASE_DIR, "device_codes.db")

ALERT_COOLDOWN_DEFAULT = {
    'soil_moisture': 60,
    'temperature': 120,
    'tank_level': 60,
    'upcoming_rain': 720,
    'water_shortage': 1440
}

ESP32_HTTP_TIMEOUT = 30
DEFAULT_LATITUDE = 35.6892
DEFAULT_LONGITUDE = 51.3890
DEFAULT_TANK_HEIGHT_MM = 1000.0
DEFAULT_TANK_CAPACITY_L = 10000.0

FARM_STATUS_THRESHOLDS = {
    'excellent': {'soil_min': 60, 'temp_max': 32, 'tank_min': 70},
    'good': {'soil_min': 40, 'temp_max': 38, 'tank_min': 40},
    'warning': {'soil_min': 25, 'temp_max': 42, 'tank_min': 20},
}

IRRIGATION_TEMPLATES = {
    'recommend_irrigation': 'با توجه به رطوبت پایین خاک ({soil_moisture}%) و عدم پیش‌بینی بارندگی در {days} روز آینده، آبیاری توصیه می‌شود.',
    'delay_irrigation': 'با توجه به پیش‌بینی بارندگی در روزهای آینده، توصیه می‌شود آبیاری به تعویق بیفتد.',
    'sufficient_moisture': 'رطوبت خاک در حد مطلوب ({soil_moisture}%) است. نیاز به آبیاری نیست.',
    'low_tank_critical': 'سطح تانک بسیار پایین است ({tank_level}%). لطفاً سریعاً تانک را پر کنید.'
}

FORGOT_PASSWORD_TEXT = 'رمز عبور را فراموش کرده‌اید؟ برای بازیابی، با پشتیبانی تماس بگیرید: ۰۲۱-۱۲۳۴۵۶۷۸'
ITEMS_PER_PAGE = 20

OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_DEFAULT_PARAMS = {
    "hourly": "temperature_2m,relative_humidity_2m,rain",
    "daily": "temperature_2m_max,temperature_2m_min,rain_sum,windspeed_10m_max,uv_index_max",
    "timezone": "auto",
    "forecast_days": 3
}

MAX_SMS_PER_RESPONSE = 5

DEFAULT_ALERT_TEMPLATES = {
    'soil_moisture': 'هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.',
    'temperature': 'هشدار! دمای گلخانه به {value}°C رسیده است.',
    'tank_level': 'هشدار! سطح آب تانک به {value}% رسیده است. {remaining_liters} لیتر باقی مانده.'
}
