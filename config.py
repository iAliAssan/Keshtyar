# config.py
# تنظیمات اصلی پروژه Smart Agriculture Assistant
# نسخه نهایی با پشتیبانی از Neon PostgreSQL (برای Vercel)

import os

# ==================== مسیرهای پایه ====================
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# ==================== دیتابیس اصلی ====================
# اولویت با DATABASE_URL (برای Vercel + Neon PostgreSQL)
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL:
    # استفاده از PostgreSQL در Vercel/Neon
    SQLALCHEMY_DATABASE_URI = DATABASE_URL
else:
    # استفاده از SQLite در محیط محلی (برای توسعه)
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{os.path.join(BASE_DIR, "instance", "farm.db")}'

SQLALCHEMY_TRACK_MODIFICATIONS = False

# ==================== امنیت ====================
# از متغیر محیطی برای SECRET_KEY استفاده کن (در Vercel)
SECRET_KEY = os.environ.get('SECRET_KEY', 'smart-agriculture-secret-key-2025-change-in-production')

# ==================== دیتابیس کدهای یکتا ====================
# برای Vercel، این فایل فقط برای محیط محلی کار می‌کند
DEVICE_CODES_DB_PATH = os.path.join(BASE_DIR, "device_codes.db")

# ==================== تنظیمات سرور (برای Vercel) ====================
SERVER_NAME = os.environ.get('SERVER_NAME', None)
PREFERRED_URL_SCHEME = os.environ.get('PREFERRED_URL_SCHEME', 'https')

# ==================== زمان‌های پیش‌فرض هشدار (دقیقه) ====================
ALERT_COOLDOWN_DEFAULT = {
    'soil_moisture': 60,      # هر ۱ ساعت
    'temperature': 120,       # هر ۲ ساعت
    'tank_level': 60,         # هر ۱ ساعت
    'upcoming_rain': 720,     # هر ۱۲ ساعت
    'water_shortage': 1440    # هر ۲۴ ساعت
}

# ==================== زمان حداکثر انتظار ESP32 (ثانیه) ====================
ESP32_HTTP_TIMEOUT = 30

# ==================== مختصات پیش‌فرض (تهران) ====================
DEFAULT_LATITUDE = 35.6892
DEFAULT_LONGITUDE = 51.3890

# ==================== تنظیمات پیش‌فرض تانک ====================
DEFAULT_TANK_HEIGHT_MM = 1000.0      # 1 متر
DEFAULT_TANK_CAPACITY_L = 10000.0    # ۱۰ هزار لیتر

# ==================== آستانه وضعیت مزرعه ====================
FARM_STATUS_THRESHOLDS = {
    'excellent': {'soil_min': 60, 'temp_max': 32, 'tank_min': 70},
    'good': {'soil_min': 40, 'temp_max': 38, 'tank_min': 40},
    'warning': {'soil_min': 25, 'temp_max': 42, 'tank_min': 20},
    # کمتر از warning = critical
}

# ==================== متن توصیه آبیاری (قالب فارسی) ====================
IRRIGATION_TEMPLATES = {
    'recommend_irrigation': 'با توجه به رطوبت پایین خاک ({soil_moisture}%) و عدم پیش‌بینی بارندگی در {days} روز آینده، آبیاری توصیه می‌شود.',
    'delay_irrigation': 'با توجه به پیش‌بینی بارندگی در روزهای آینده، توصیه می‌شود آبیاری به تعویق بیفتد.',
    'sufficient_moisture': 'رطوبت خاک در حد مطلوب ({soil_moisture}%) است. نیاز به آبیاری نیست.',
    'low_tank_critical': 'سطح تانک بسیار پایین است ({tank_level}%). لطفاً سریعاً تانک را پر کنید.'
}

# ==================== متن صفحه ورود (فراموشی رمز) ====================
FORGOT_PASSWORD_TEXT = 'رمز عبور را فراموش کرده‌اید؟ برای بازیابی، با پشتیبانی تماس بگیرید: ۰۲۱-۱۲۳۴۵۶۷۸'

# ==================== صفحه‌بندی ====================
ITEMS_PER_PAGE = 20

# ==================== تنظیمات Open-Meteo ====================
OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_DEFAULT_PARAMS = {
    "hourly": "temperature_2m,relative_humidity_2m,rain",
    "daily": "temperature_2m_max,temperature_2m_min,rain_sum,windspeed_10m_max,uv_index_max",
    "timezone": "auto",
    "forecast_days": 3
}

# ==================== تنظیمات SMS ارسال از طریق ESP32 ====================
# حداکثر تعداد SMS در هر درخواست پاسخ به ESP32
MAX_SMS_PER_RESPONSE = 5

# ==================== متن هشدارهای پیش‌فرض (برای قوانین جدید) ====================
DEFAULT_ALERT_TEMPLATES = {
    'soil_moisture': 'هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.',
    'temperature': 'هشدار! دمای گلخانه به {value}°C رسیده است.',
    'tank_level': 'هشدار! سطح آب تانک به {value}% رسیده است. {remaining_liters} لیتر باقی مانده.'
}
