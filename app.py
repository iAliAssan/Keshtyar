# app.py
# فایل اصلی Flask برای Smart Agriculture Assistant
# نسخه نهایی: پشتیبانی از قوانین اتوماسیون با سنسورهای مختلف (رطوبت خاک، دما، سطح تانک) و عملگرهای (below, above, equal, not_equal)

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from datetime import datetime, timedelta
import sqlite3
import json
import uuid

from config import *
from models import db, User, Relay, SensorData, AutomationRule, AlertRule, CommandLog, AvailableDeviceCode, create_default_user
from helpers import (
    get_weather_forecast, get_hourly_forecast, calculate_farm_status, get_farm_status_persian,
    generate_irrigation_recommendation, calculate_water_consumption,
    evaluate_automation_rules, check_alert_rules, get_chart_data
)
from utils import get_current_tehran_naive

# ==================== راه‌اندازی اپلیکیشن ====================
app = Flask(__name__)
app.config['SECRET_KEY'] = SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = SQLALCHEMY_DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = SQLALCHEMY_TRACK_MODIFICATIONS

db.init_app(app)

# ==================== راه‌اندازی Flask-Login ====================
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ==================== ایجاد دیتابیس در اولین اجرا ====================
with app.app_context():
    db.create_all()

    import os
    if os.path.exists(DEVICE_CODES_DB_PATH):
        try:
            codes_conn = sqlite3.connect(DEVICE_CODES_DB_PATH)
            codes_cursor = codes_conn.cursor()
            codes_cursor.execute("SELECT code FROM authorized_codes WHERE used = 0")
            codes = codes_cursor.fetchall()
            codes_conn.close()

            for (code,) in codes:
                existing = AvailableDeviceCode.query.filter_by(code=code).first()
                if not existing:
                    available_code = AvailableDeviceCode(code=code, used=False)
                    db.session.add(available_code)
            db.session.commit()
            print(f"✅ {len(codes)} کد یکتا از device_codes.db به دیتابیس منتقل شد.")
        except Exception as e:
            print(f"خطا در انتقال کدها: {e}")

    create_default_user()


# ==================== context processor برای زمان تهران ====================
@app.context_processor
def utility_processor():
    def now_tehran():
        return get_current_tehran_naive()
    return {'now_tehran': now_tehran}


# ==================== روت‌های صفحات ====================

@app.route('/')
def index():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))
    return redirect(url_for('login'))


@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        device_code = request.form.get('device_code', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(device_code=device_code).first()

        if user and user.check_password(password):
            login_user(user)
            flash('با موفقیت وارد شدید.', 'success')
            return redirect(url_for('dashboard'))
        else:
            flash('کد یکتا یا رمز عبور اشتباه است.', 'danger')

    return render_template('login.html', forgot_text=FORGOT_PASSWORD_TEXT)


@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('dashboard'))

    if request.method == 'POST':
        device_code = request.form.get('device_code', '').strip()
        password = request.form.get('password', '')
        password_confirm = request.form.get('password_confirm', '')
        farm_name = request.form.get('farm_name', 'مزرعه من')
        phone_number = request.form.get('phone_number', '')
        latitude = request.form.get('latitude', DEFAULT_LATITUDE)
        longitude = request.form.get('longitude', DEFAULT_LONGITUDE)

        if password != password_confirm:
            flash('رمز عبور و تأیید آن مطابقت ندارند.', 'danger')
            return redirect(url_for('register'))

        if len(password) < 4:
            flash('رمز عبور باید حداقل ۴ کاراکتر باشد.', 'danger')
            return redirect(url_for('register'))

        available_code = AvailableDeviceCode.query.filter_by(code=device_code, used=False).first()
        if not available_code:
            flash('کد یکتا معتبر نیست یا قبلاً استفاده شده است.', 'danger')
            return redirect(url_for('register'))

        existing_user = User.query.filter_by(device_code=device_code).first()
        if existing_user:
            flash('این کد یکتا قبلاً ثبت نام کرده است.', 'danger')
            return redirect(url_for('register'))

        user = User(
            device_code=device_code,
            farm_name=farm_name,
            phone_number=phone_number,
            latitude=float(latitude),
            longitude=float(longitude)
        )
        user.set_password(password)
        db.session.add(user)
        available_code.used = True
        db.session.commit()

        flash('ثبت نام با موفقیت انجام شد. اکنون وارد شوید.', 'success')
        return redirect(url_for('login'))

    return render_template('register.html', default_lat=DEFAULT_LATITUDE, default_lon=DEFAULT_LONGITUDE)


@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('از سیستم خارج شدید.', 'info')
    return redirect(url_for('login'))


@app.route('/dashboard')
@login_required
def dashboard():
    last_sensor = SensorData.query.filter_by(user_id=current_user.id).order_by(SensorData.timestamp.desc()).first()
    forecast = get_weather_forecast(current_user.latitude, current_user.longitude)

    current_data = {
        'temperature': last_sensor.temperature if last_sensor else None,
        'humidity': last_sensor.humidity if last_sensor else None,
        'soil_moisture': last_sensor.soil_moisture if last_sensor else None,
        'tank_level': last_sensor.tank_level_percent if last_sensor else None,
        'tank_liters': last_sensor.tank_liters if last_sensor else None
    }

    if last_sensor:
        farm_status = calculate_farm_status(
            last_sensor.soil_moisture or 0,
            last_sensor.temperature or 0,
            last_sensor.tank_level_percent or 0
        )
        farm_status_text = get_farm_status_persian(farm_status)
    else:
        farm_status = 'critical'
        farm_status_text = 'بدون داده'

    irrigation_rec = generate_irrigation_recommendation(
        current_data['soil_moisture'] or 0,
        forecast,
        current_data['tank_level'] or 0
    )

    chart_data = get_chart_data(current_user.id, 1)

    return render_template(
        'dashboard.html',
        current_data=current_data,
        forecast=forecast,
        farm_status=farm_status,
        farm_status_text=farm_status_text,
        irrigation_rec=irrigation_rec,
        chart_data=chart_data
    )


@app.route('/history')
@login_required
def history():
    days = request.args.get('days', 7, type=int)
    chart_data = get_chart_data(current_user.id, days)
    return render_template('history.html', chart_data=chart_data, days=days)


@app.route('/relays')
@login_required
def relays():
    user_relays = Relay.query.filter_by(user_id=current_user.id).all()
    return render_template('relays.html', relays=user_relays)


@app.route('/relays/add', methods=['POST'])
@login_required
def add_relay():
    name = request.form.get('name', '').strip()
    gpio = request.form.get('gpio', type=int)

    ALLOWED_GPIO = [12, 13, 14, 15]
    if gpio not in ALLOWED_GPIO:
        flash(f'GPIO مجاز فقط {ALLOWED_GPIO} است.', 'danger')
        return redirect(url_for('relays'))

    if name and gpio:
        existing = Relay.query.filter_by(user_id=current_user.id, gpio=gpio).first()
        if existing:
            flash(f'GPIO {gpio} قبلاً استفاده شده است.', 'danger')
        else:
            relay = Relay(user_id=current_user.id, name=name, gpio=gpio, state=False)
            db.session.add(relay)
            db.session.commit()
            flash('رله با موفقیت اضافه شد.', 'success')
    else:
        flash('نام و GPIO الزامی است.', 'danger')

    return redirect(url_for('relays'))


@app.route('/relays/toggle/<int:relay_id>')
@login_required
def toggle_relay(relay_id):
    relay = Relay.query.filter_by(id=relay_id, user_id=current_user.id).first()
    if relay:
        new_state = not relay.state
        relay.state = new_state
        db.session.commit()

        command_id = CommandLog.generate_command_id()
        command = CommandLog(
            user_id=current_user.id,
            command_id=command_id,
            command_type='relay_set',
            payload=json.dumps({'gpio': relay.gpio, 'state': new_state}),
            acknowledged=False
        )
        db.session.add(command)
        db.session.commit()

        flash(f'وضعیت {relay.name} تغییر کرد.', 'success')
    else:
        flash('رله یافت نشد.', 'danger')

    return redirect(url_for('relays'))


@app.route('/relays/delete/<int:relay_id>')
@login_required
def delete_relay(relay_id):
    relay = Relay.query.filter_by(id=relay_id, user_id=current_user.id).first()
    if relay:
        db.session.delete(relay)
        db.session.commit()
        flash('رله حذف شد.', 'success')
    else:
        flash('رله یافت نشد.', 'danger')
    return redirect(url_for('relays'))


@app.route('/rules')
@login_required
def rules():
    user_rules = AutomationRule.query.filter_by(user_id=current_user.id).all()
    user_relays = Relay.query.filter_by(user_id=current_user.id).all()
    return render_template('rules.html', rules=user_rules, relays=user_relays)


@app.route('/rules/add', methods=['POST'])
@login_required
def add_rule():
    name = request.form.get('name', '').strip()
    relay_id = request.form.get('relay_id', type=int)
    action_state = request.form.get('action_state') == 'on'
    condition_type = request.form.get('condition_type', 'single')

    if not name or not relay_id:
        flash('نام و رله الزامی است.', 'danger')
        return redirect(url_for('rules'))

    if condition_type == 'and':
        # قانون ترکیبی (AND) - شرط اول همیشه رطوبت خاک
        rule_type = request.form.get('rule_type_and')  # 'moisture_below' یا 'moisture_above'
        threshold = request.form.get('threshold', type=float)
        second_sensor_type = request.form.get('second_sensor_type')
        second_operator = request.form.get('second_operator')
        second_threshold = request.form.get('second_threshold', type=float)

        if not rule_type or threshold is None or not second_sensor_type or not second_operator or second_threshold is None:
            flash('تمامی فیلدهای قانون ترکیبی الزامی است.', 'danger')
            return redirect(url_for('rules'))

        rule = AutomationRule(
            user_id=current_user.id,
            relay_id=relay_id,
            name=name,
            rule_type=rule_type,
            threshold=threshold,
            action_state=action_state,
            active=True,
            condition_type='and',
            second_sensor_type=second_sensor_type,
            second_operator=second_operator,
            second_threshold=second_threshold
        )
    elif condition_type == 'single':
        # قانون ساده با انتخاب سنسور و عملگر
        sensor = request.form.get('sensor_type')
        operator = request.form.get('operator')
        threshold = request.form.get('threshold', type=float)

        if not sensor or not operator or threshold is None:
            flash('تمامی فیلدهای قانون ساده الزامی است.', 'danger')
            return redirect(url_for('rules'))

        # ساخت rule_type به صورت ترکیبی مانند "temperature_below"
        rule_type = f"{sensor}_{operator}"

        rule = AutomationRule(
            user_id=current_user.id,
            relay_id=relay_id,
            name=name,
            rule_type=rule_type,
            threshold=threshold,
            action_state=action_state,
            active=True,
            condition_type='single'
        )
    else:
        flash('نوع قانون نامعتبر است.', 'danger')
        return redirect(url_for('rules'))

    db.session.add(rule)
    db.session.commit()
    flash('قانون با موفقیت اضافه شد.', 'success')
    return redirect(url_for('rules'))


@app.route('/rules/toggle/<int:rule_id>')
@login_required
def toggle_rule(rule_id):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if rule:
        rule.active = not rule.active
        db.session.commit()
        flash('وضعیت قانون تغییر کرد.', 'success')
    else:
        flash('قانون یافت نشد.', 'danger')
    return redirect(url_for('rules'))


@app.route('/rules/delete/<int:rule_id>')
@login_required
def delete_rule(rule_id):
    rule = AutomationRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if rule:
        db.session.delete(rule)
        db.session.commit()
        flash('قانون حذف شد.', 'success')
    else:
        flash('قانون یافت نشد.', 'danger')
    return redirect(url_for('rules'))


@app.route('/alert_rules')
@login_required
def alert_rules():
    user_alert_rules = AlertRule.query.filter_by(user_id=current_user.id).all()
    return render_template('alert_rules.html', alert_rules=user_alert_rules)


@app.route('/alert_rules/add', methods=['POST'])
@login_required
def add_alert_rule():
    name = request.form.get('name', '').strip()
    sensor_type = request.form.get('sensor_type')
    operator = request.form.get('operator')
    threshold = request.form.get('threshold', type=float)
    sms_template = request.form.get('sms_template', '').strip()

    if not all([name, sensor_type, operator, threshold, sms_template]):
        flash('تمام فیلدها الزامی هستند.', 'danger')
        return redirect(url_for('alert_rules'))

    rule = AlertRule(
        user_id=current_user.id,
        name=name,
        sensor_type=sensor_type,
        operator=operator,
        threshold=threshold,
        sms_template=sms_template,
        enabled=True
    )
    db.session.add(rule)
    db.session.commit()
    flash('قانون هشدار با موفقیت اضافه شد.', 'success')
    return redirect(url_for('alert_rules'))


@app.route('/alert_rules/toggle/<int:rule_id>')
@login_required
def toggle_alert_rule(rule_id):
    rule = AlertRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if rule:
        rule.enabled = not rule.enabled
        db.session.commit()
        flash('وضعیت قانون هشدار تغییر کرد.', 'success')
    else:
        flash('قانون یافت نشد.', 'danger')
    return redirect(url_for('alert_rules'))


@app.route('/alert_rules/delete/<int:rule_id>')
@login_required
def delete_alert_rule(rule_id):
    rule = AlertRule.query.filter_by(id=rule_id, user_id=current_user.id).first()
    if rule:
        db.session.delete(rule)
        db.session.commit()
        flash('قانون هشدار حذف شد.', 'success')
    else:
        flash('قانون یافت نشد.', 'danger')
    return redirect(url_for('alert_rules'))


@app.route('/settings', methods=['GET', 'POST'])
@login_required
def settings():
    if request.method == 'POST':
        current_user.farm_name = request.form.get('farm_name', current_user.farm_name)
        current_user.phone_number = request.form.get('phone_number', current_user.phone_number)
        current_user.latitude = request.form.get('latitude', type=float) or DEFAULT_LATITUDE
        current_user.longitude = request.form.get('longitude', type=float) or DEFAULT_LONGITUDE
        current_user.tank_height_mm = request.form.get('tank_height_mm', type=float) or DEFAULT_TANK_HEIGHT_MM
        current_user.tank_capacity_liters = request.form.get('tank_capacity_liters', type=float) or DEFAULT_TANK_CAPACITY_L

        if request.form.get('soil_dry_raw'):
            current_user.soil_dry_raw = int(request.form.get('soil_dry_raw'))
        if request.form.get('soil_wet_raw'):
            current_user.soil_wet_raw = int(request.form.get('soil_wet_raw'))

        current_user.alert_cooldown_soil = request.form.get('alert_cooldown_soil', type=int) or 60
        current_user.alert_cooldown_temp = request.form.get('alert_cooldown_temp', type=int) or 120
        current_user.alert_cooldown_tank = request.form.get('alert_cooldown_tank', type=int) or 60

        db.session.commit()

        old_password = request.form.get('old_password')
        new_password = request.form.get('new_password')
        new_password_confirm = request.form.get('new_password_confirm')

        if old_password and new_password:
            if current_user.check_password(old_password):
                if new_password == new_password_confirm and len(new_password) >= 4:
                    current_user.set_password(new_password)
                    db.session.commit()
                    flash('تنظیمات ذخیره شد. رمز عبور تغییر کرد.', 'success')
                else:
                    flash('رمز جدید مطابقت ندارد یا کمتر از ۴ کاراکتر است.', 'danger')
            else:
                flash('رمز عبور فعلی اشتباه است.', 'danger')
        else:
            flash('تنظیمات با موفقیت ذخیره شد.', 'success')

        return redirect(url_for('settings'))

    water_consumption = calculate_water_consumption(current_user.id)
    return render_template('settings.html', user=current_user, water_consumption=water_consumption)


@app.route('/device_config')
@login_required
def device_config():
    api_url = request.host_url.rstrip('/') + '/api/sensor'
    return render_template('device_config.html', device_code=current_user.device_code, api_url=api_url)


# ==================== APIهای ESP32 ====================

@app.route('/api/sensor', methods=['POST'])
def api_sensor():
    try:
        data = request.get_json()
        if not data:
            return jsonify({'status': 'error', 'message': 'No data received'}), 400

        device_code = data.get('device_code')
        if not device_code:
            return jsonify({'status': 'error', 'message': 'device_code required'}), 400

        user = User.query.filter_by(device_code=device_code).first()
        if not user:
            return jsonify({'status': 'error', 'message': 'Invalid device code'}), 401

        soil_raw = data.get('soil_moisture_raw')
        soil_percent = user.calculate_soil_moisture_percent(soil_raw)

        sensor = SensorData(
            user_id=user.id,
            temperature=data.get('temperature'),
            humidity=data.get('humidity'),
            soil_moisture_raw=soil_raw,
            soil_moisture=soil_percent,
            tank_distance_mm=data.get('tank_distance_mm')
        )
        tank_height = user.tank_height_mm if user.tank_height_mm is not None else DEFAULT_TANK_HEIGHT_MM
        tank_capacity = user.tank_capacity_liters if user.tank_capacity_liters is not None else DEFAULT_TANK_CAPACITY_L
        sensor.calculate_tank(tank_height, tank_capacity)
        db.session.add(sensor)
        db.session.commit()

        relays = Relay.query.filter_by(user_id=user.id).all()
        relay_states = {str(r.gpio): r.state for r in relays}

        # ارزیابی قوانین اتوماسیون با ارسال مقادیر سنسورها
        auto_commands = evaluate_automation_rules(
            user.id,
            current_soil_moisture=sensor.soil_moisture or 0,
            current_temperature=sensor.temperature or 0,
            current_tank_level=sensor.tank_level_percent or 0
        )

        pending_commands = CommandLog.query.filter_by(
            user_id=user.id, acknowledged=False
        ).all()

        commands = []
        for cmd in pending_commands:
            commands.append({
                "id": cmd.command_id,
                "type": cmd.command_type,
                "payload": json.loads(cmd.payload) if cmd.payload else {}
            })

        for auto_cmd in auto_commands:
            cmd_id = CommandLog.generate_command_id()
            commands.append({
                "id": cmd_id,
                "type": auto_cmd['type'],
                "payload": auto_cmd['payload']
            })
            new_cmd = CommandLog(
                user_id=user.id,
                command_id=cmd_id,
                command_type=auto_cmd['type'],
                payload=json.dumps(auto_cmd['payload']),
                acknowledged=False
            )
            db.session.add(new_cmd)

        db.session.commit()

        forecast = get_weather_forecast(user.latitude, user.longitude)
        sensor_dict = {
            'soil_moisture': sensor.soil_moisture,
            'temperature': sensor.temperature,
            'tank_level_percent': sensor.tank_level_percent
        }
        sms_requests = check_alert_rules(user.id, sensor_dict, sensor.tank_liters, forecast)

        response = {
            'status': 'ok',
            'relay_states': relay_states,
            'commands': commands,
            'sms_requests': sms_requests,
            'automation_results': []
        }

        return jsonify(response)

    except Exception as e:
        print(f"Error in /api/sensor: {e}")
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/command/<string:command_id>/ack', methods=['POST'])
def api_command_ack(command_id):
    try:
        command = CommandLog.query.filter_by(command_id=command_id).first()
        if command:
            command.acknowledged = True
            command.acknowledged_at = get_current_tehran_naive()
            db.session.commit()
            return jsonify({'status': 'ok', 'message': 'Command acknowledged'})
        else:
            return jsonify({'status': 'error', 'message': 'Command not found'}), 404
    except Exception as e:
        return jsonify({'status': 'error', 'message': str(e)}), 500


@app.route('/api/last_sensor_data')
@login_required
def api_last_sensor_data():
    try:
        last_data = SensorData.query.filter_by(user_id=current_user.id).order_by(SensorData.timestamp.desc()).first()
        if last_data and last_data.timestamp:
            return jsonify({'success': True, 'last_update': last_data.timestamp.isoformat()})
        return jsonify({'success': False, 'last_update': None})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/hourly_forecast')
@login_required
def api_hourly_forecast():
    lat = current_user.latitude
    lon = current_user.longitude
    forecast = get_hourly_forecast(lat, lon)
    if forecast:
        return jsonify({'success': True, 'data': forecast})
    else:
        return jsonify({'success': False, 'message': 'خطا در دریافت پیش‌بینی'}), 500


@app.route('/api/calibrate_soil', methods=['POST'])
@login_required
def api_calibrate_soil():
    try:
        data = request.get_json()
        cal_type = data.get('type')
        if cal_type not in ['dry', 'wet']:
            return jsonify({'success': False, 'message': 'نوع کالیبراسیون نامعتبر'}), 400

        last_sensor = SensorData.query.filter_by(user_id=current_user.id).order_by(SensorData.timestamp.desc()).first()
        if not last_sensor or last_sensor.soil_moisture_raw is None:
            return jsonify({'success': False, 'message': 'هیچ داده رطوبت خاکی موجود نیست. لطفاً ابتدا سنسور را متصل کنید.'}), 400

        raw_value = last_sensor.soil_moisture_raw
        if cal_type == 'dry':
            current_user.soil_dry_raw = raw_value
            message = f'مقدار خشک (هوا) با موفقیت ثبت شد: {raw_value}'
        else:
            current_user.soil_wet_raw = raw_value
            message = f'مقدار مرطوب (آب) با موفقیت ثبت شد: {raw_value}'

        db.session.commit()
        return jsonify({'success': True, 'message': message, 'value': raw_value})

    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500


# ==================== اجرای برنامه ====================
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)