# helpers.py
# توابع کمکی برای Smart Agriculture Assistant
# نسخه نهایی: پشتیبانی از قوانین اتوماسیون با سنسورهای مختلف (رطوبت خاک، دما، سطح تانک)
# و عملگرهای (below, above, equal, not_equal) + قوانین ترکیبی AND

import requests
from datetime import datetime, timedelta
from models import db, SensorData, Relay, AutomationRule, AlertRule, CommandLog, User
from config import (
    FARM_STATUS_THRESHOLDS, IRRIGATION_TEMPLATES, OPEN_METEO_URL,
    OPEN_METEO_DEFAULT_PARAMS
)
from utils import get_current_tehran_naive


def get_weather_forecast(latitude, longitude):
    """دریافت پیش‌بینی آب و هوا از Open-Meteo (خلاصه روزانه)"""
    params = OPEN_METEO_DEFAULT_PARAMS.copy()
    params["latitude"] = latitude
    params["longitude"] = longitude

    try:
        response = requests.get(OPEN_METEO_URL, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        daily = data.get("daily", {})

        forecast = {
            "current": {
                "temperature": daily.get("temperature_2m_max", [0])[0] if daily.get("temperature_2m_max") else 0,
                "rain": daily.get("rain_sum", [0])[0] if daily.get("rain_sum") else 0,
                "wind": daily.get("windspeed_10m_max", [0])[0] if daily.get("windspeed_10m_max") else 0,
                "uv_index": daily.get("uv_index_max", [0])[0] if daily.get("uv_index_max") else 0
            },
            "today": {
                "temp_max": daily.get("temperature_2m_max", [0])[0] if len(daily.get("temperature_2m_max", [])) > 0 else 0,
                "temp_min": daily.get("temperature_2m_min", [0])[0] if len(daily.get("temperature_2m_min", [])) > 0 else 0,
                "rain": daily.get("rain_sum", [0])[0] if len(daily.get("rain_sum", [])) > 0 else 0
            },
            "tomorrow": {
                "temp_max": daily.get("temperature_2m_max", [0])[1] if len(daily.get("temperature_2m_max", [])) > 1 else 0,
                "temp_min": daily.get("temperature_2m_min", [0])[1] if len(daily.get("temperature_2m_min", [])) > 1 else 0,
                "rain": daily.get("rain_sum", [0])[1] if len(daily.get("rain_sum", [])) > 1 else 0
            },
            "next_3_days": {
                "temp_max": max(daily.get("temperature_2m_max", [0])[1:4]) if len(daily.get("temperature_2m_max", [])) > 3 else 0,
                "temp_min": min(daily.get("temperature_2m_min", [0])[1:4]) if len(daily.get("temperature_2m_min", [])) > 3 else 0,
                "total_rain": sum(daily.get("rain_sum", [0])[1:4]) if len(daily.get("rain_sum", [])) > 3 else 0
            }
        }
        return forecast
    except Exception as e:
        print(f"خطا در دریافت آب و هوا: {e}")
        return None


def get_hourly_forecast(latitude, longitude, hours=48):
    """دریافت پیش‌بینی ساعتی آب و هوا (برای نمایش جزئیات هر روز)"""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "temperature_2m,relative_humidity_2m",
        "forecast_days": 3,
        "timezone": "auto"
    }
    try:
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()
        hourly = data.get('hourly', {})
        times = hourly.get('time', [])
        temps = hourly.get('temperature_2m', [])
        hums = hourly.get('relative_humidity_2m', [])

        result = {}
        for i, t in enumerate(times):
            day = t[:10]  # YYYY-MM-DD
            if day not in result:
                result[day] = []
            result[day].append({
                'time': t[11:16],  # HH:MM
                'temp': temps[i] if i < len(temps) else None,
                'humidity': hums[i] if i < len(hums) else None
            })
        return result
    except Exception as e:
        print(f"خطا در دریافت پیش‌بینی ساعتی: {e}")
        return None


def calculate_farm_status(soil_moisture, temperature, tank_level_percent):
    """محاسبه وضعیت مزرعه - ایمن در برابر None"""
    soil = soil_moisture if soil_moisture is not None else 0
    temp = temperature if temperature is not None else 0
    tank = tank_level_percent if tank_level_percent is not None else 0
    thresholds = FARM_STATUS_THRESHOLDS

    if (soil >= thresholds['excellent']['soil_min'] and
        temp <= thresholds['excellent']['temp_max'] and
        tank >= thresholds['excellent']['tank_min']):
        return 'excellent'
    elif (soil >= thresholds['good']['soil_min'] and
          temp <= thresholds['good']['temp_max'] and
          tank >= thresholds['good']['tank_min']):
        return 'good'
    elif (soil >= thresholds['warning']['soil_min'] and
          temp <= thresholds['warning']['temp_max'] and
          tank >= thresholds['warning']['tank_min']):
        return 'warning'
    else:
        return 'critical'


def get_farm_status_persian(status):
    status_map = {
        'excellent': 'عالی',
        'good': 'خوب',
        'warning': 'هشدار',
        'critical': 'بحرانی'
    }
    return status_map.get(status, 'نامشخص')


def generate_irrigation_recommendation(soil_moisture, forecast, tank_level_percent):
    """تولید توصیه آبیاری به فارسی - ایمن در برابر None"""
    soil = soil_moisture if soil_moisture is not None else 0
    tank = tank_level_percent if tank_level_percent is not None else 0
    templates = IRRIGATION_TEMPLATES

    if tank < 15:
        return templates['low_tank_critical'].format(tank_level=int(tank))

    rain_coming = False
    rain_days = 0

    if forecast:
        today_rain = forecast.get('today', {}).get('rain', 0)
        tomorrow_rain = forecast.get('tomorrow', {}).get('rain', 0)
        next_rain = forecast.get('next_3_days', {}).get('total_rain', 0)

        if today_rain > 5 or tomorrow_rain > 5 or next_rain > 10:
            rain_coming = True
            if today_rain > 5:
                rain_days = 1
            elif tomorrow_rain > 5:
                rain_days = 2
            else:
                rain_days = 3

    if soil < 30:
        if rain_coming:
            if soil < 20:
                return f"رطوبت خاک بسیار کم است ({soil:.0f}%). با وجود پیش‌بینی باران، وضعیت بحرانی است. آبیاری فوری توصیه می‌شود."
            else:
                return templates['delay_irrigation']
        else:
            return templates['recommend_irrigation'].format(soil_moisture=int(soil), days=2)
    elif 30 <= soil < 50:
        if rain_coming:
            return templates['delay_irrigation']
        else:
            return f"رطوبت خاک در حد قابل قبول است ({soil:.0f}%). در ۲۴ ساعت آینده نیاز به آبیاری نیست."
    else:
        return templates['sufficient_moisture'].format(soil_moisture=int(soil))


def calculate_water_consumption(user_id, days=30):
    """تحلیل مصرف آب بر اساس داده‌های تاریخی تانک"""
    user = User.query.get(user_id)
    if not user:
        return None

    end_date = get_current_tehran_naive()
    start_date = end_date - timedelta(days=days)

    data = SensorData.query.filter(
        SensorData.user_id == user_id,
        SensorData.timestamp >= start_date,
        SensorData.tank_liters.isnot(None)
    ).order_by(SensorData.timestamp.asc()).all()

    if len(data) < 2:
        return {
            'daily_avg': 0,
            'weekly_avg': 0,
            'monthly_avg': 0,
            'remaining_days': 0,
            'current_water': 0
        }

    total_consumption = 0
    days_with_data = 0

    for i in range(1, len(data)):
        time_diff = (data[i].timestamp - data[i-1].timestamp).total_seconds() / 3600 / 24
        if time_diff > 0 and data[i-1].tank_liters > data[i].tank_liters:
            consumption = data[i-1].tank_liters - data[i].tank_liters
            if 0 < consumption < 5000:
                total_consumption += consumption
                days_with_data += time_diff

    if days_with_data == 0:
        daily_avg = 0
    else:
        daily_avg = total_consumption / days_with_data

    weekly_avg = daily_avg * 7
    monthly_avg = daily_avg * 30
    current_water = data[-1].tank_liters if data[-1].tank_liters else 0
    remaining_days = int(current_water / daily_avg) if daily_avg > 0 else 0

    return {
        'daily_avg': round(daily_avg),
        'weekly_avg': round(weekly_avg),
        'monthly_avg': round(monthly_avg),
        'remaining_days': remaining_days,
        'current_water': round(current_water)
    }


def evaluate_automation_rules(user_id, current_soil_moisture, current_temperature=None, current_tank_level=None, current_time=None):
    """
    ارزیابی قوانین اتوماسیون (ساده با سنسورهای مختلف و ترکیبی AND)
    جلوگیری از فرمان‌های تکراری
    """
    if current_time is None:
        current_time = get_current_tehran_naive()

    rules = AutomationRule.query.filter_by(user_id=user_id, active=True).all()
    commands = []

    for rule in rules:
        should_execute = False

        # قانون ترکیبی (AND)
        if rule.condition_type == 'and' and rule.second_sensor_type:
            if current_soil_moisture is not None and current_temperature is not None and current_tank_level is not None:
                # شرط اول (رطوبت خاک)
                first_ok = False
                if rule.rule_type == 'moisture_below':
                    first_ok = current_soil_moisture < rule.threshold
                elif rule.rule_type == 'moisture_above':
                    first_ok = current_soil_moisture > rule.threshold
                if first_ok:
                    # شرط دوم (دما یا سطح تانک)
                    second_value = current_temperature if rule.second_sensor_type == 'temperature' else current_tank_level
                    if second_value is not None:
                        if rule.second_operator == 'below':
                            should_execute = second_value < rule.second_threshold
                        elif rule.second_operator == 'above':
                            should_execute = second_value > rule.second_threshold
        # قانون زمانبندی
        elif rule.rule_type == 'schedule':
            should_execute = rule.evaluate_schedule(current_time)
        # قانون ساده با سنسور و عملگر دلخواه
        else:
            # rule_type به صورت "sensor_operator" مانند "temperature_below"
            parts = rule.rule_type.split('_')
            if len(parts) >= 2:
                sensor = parts[0]      # soil_moisture, temperature, tank_level
                operator = parts[1]    # below, above, equal, not_equal
                # مقدار جاری سنسور
                current_value = None
                if sensor == 'soil_moisture':
                    current_value = current_soil_moisture
                elif sensor == 'temperature':
                    current_value = current_temperature
                elif sensor == 'tank_level':
                    current_value = current_tank_level

                if current_value is not None:
                    if operator == 'below':
                        should_execute = current_value < rule.threshold
                    elif operator == 'above':
                        should_execute = current_value > rule.threshold
                    elif operator == 'equal':
                        should_execute = abs(current_value - rule.threshold) < 0.01
                    elif operator == 'not_equal':
                        should_execute = abs(current_value - rule.threshold) > 0.01
            else:
                # Fallback برای قوانین قدیمی (moisture_below, moisture_above)
                if current_soil_moisture is not None:
                    if rule.rule_type == 'moisture_below':
                        should_execute = current_soil_moisture < rule.threshold
                    elif rule.rule_type == 'moisture_above':
                        should_execute = current_soil_moisture > rule.threshold

        if should_execute:
            # جلوگیری از اجرای مکرر در بازه کوتاه (5 دقیقه)
            if rule.last_triggered:
                time_since = (current_time - rule.last_triggered).total_seconds() / 60
                if time_since < 5:
                    continue

            rule.last_triggered = current_time
            db.session.commit()

            relay = Relay.query.get(rule.relay_id)
            if relay and relay.state != rule.action_state:
                relay.state = rule.action_state
                db.session.commit()
                commands.append({
                    "type": "relay_set",
                    "payload": {
                        "gpio": relay.gpio,
                        "state": rule.action_state
                    }
                })

    return commands


def check_alert_rules(user_id, sensor_dict, tank_liters, forecast=None):
    """بررسی قوانین هشدار و بازگشت لیست SMSها (با مدیریت cooldown)"""
    alert_rules = AlertRule.query.filter_by(user_id=user_id, enabled=True).all()
    user = User.query.get(user_id)
    if not user:
        return []

    sms_requests = []
    now = get_current_tehran_naive()

    # هشدار ویژه باران
    if forecast and user.phone_number:
        today_rain = forecast.get('today', {}).get('rain', 0)
        tomorrow_rain = forecast.get('tomorrow', {}).get('rain', 0)
        if today_rain > 5 or tomorrow_rain > 5:
            cooldown_minutes = user.get_cooldown_for_alert_type('upcoming_rain')
            last_alert = AlertRule.query.filter_by(user_id=user_id, sensor_type='upcoming_rain').first()
            if last_alert and last_alert.last_sent_at:
                time_since = (now - last_alert.last_sent_at).total_seconds() / 60
                if time_since >= cooldown_minutes:
                    last_alert.last_sent_at = now
                    db.session.commit()
                    sms_requests.append({
                        "phone_number": user.phone_number,
                        "text": f"پیش‌بینی بارندگی در روزهای آینده با میزان {max(today_rain, tomorrow_rain)} میلی‌متر. در صورت نیاز آبیاری را به تعویق بیندازید."
                    })
            elif last_alert:
                last_alert.last_sent_at = now
                db.session.commit()
                sms_requests.append({
                    "phone_number": user.phone_number,
                    "text": f"پیش‌بینی بارندگی در روزهای آینده با میزان {max(today_rain, tomorrow_rain)} میلی‌متر. در صورت نیاز آبیاری را به تعویق بیندازید."
                })

    # قوانین معمولی
    for rule in alert_rules:
        if rule.sensor_type not in sensor_dict:
            continue
        current_value = sensor_dict[rule.sensor_type]
        if current_value is None:
            continue

        if rule.evaluate(current_value):
            cooldown_minutes = user.get_cooldown_for_alert_type(rule.sensor_type)
            if rule.last_sent_at:
                time_since = (now - rule.last_sent_at).total_seconds() / 60
                if time_since < cooldown_minutes:
                    continue

            rule.last_sent_at = now
            db.session.commit()
            remaining = tank_liters if rule.sensor_type == 'tank_level' else None
            message = rule.format_message(current_value, remaining)
            if user.phone_number:
                sms_requests.append({
                    "phone_number": user.phone_number,
                    "text": message
                })

    return sms_requests


def get_chart_data(user_id, days):
    """دریافت داده‌های نمودار برای بازه زمانی مشخص (با تبدیل زمان به تهران)"""
    start_date = get_current_tehran_naive() - timedelta(days=days)
    data = SensorData.query.filter(
        SensorData.user_id == user_id,
        SensorData.timestamp >= start_date,
        SensorData.soil_moisture.isnot(None)
    ).order_by(SensorData.timestamp.asc()).all()

    timestamps = [d.timestamp.strftime("%Y-%m-%d %H:%M") for d in data]
    soil_moistures = [d.soil_moisture if d.soil_moisture is not None else 0 for d in data]
    temperatures = [d.temperature if d.temperature is not None else 0 for d in data]
    tank_levels = [d.tank_level_percent if d.tank_level_percent is not None else 0 for d in data]

    return {
        'timestamps': timestamps,
        'soil_moisture': soil_moistures,
        'temperature': temperatures,
        'tank_level': tank_levels
    }