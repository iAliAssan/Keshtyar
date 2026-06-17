# models.py
# مدل‌های دیتابیس برای Smart Agriculture Assistant
# نسخه نهایی: زمان تهران، قوانین چندشرطی، ایمن‌سازی None

from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
import hashlib
import uuid
from utils import get_current_tehran_naive

db = SQLAlchemy()


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    device_code = db.Column(db.String(50), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)

    farm_name = db.Column(db.String(100), default='مزرعه من')
    latitude = db.Column(db.Float, default=35.6892)
    longitude = db.Column(db.Float, default=51.3890)
    phone_number = db.Column(db.String(20))

    tank_height_mm = db.Column(db.Float, default=1000.0)
    tank_capacity_liters = db.Column(db.Float, default=10000.0)

    soil_dry_raw = db.Column(db.Integer, default=3500)
    soil_wet_raw = db.Column(db.Integer, default=1500)

    alert_cooldown_soil = db.Column(db.Integer, default=60)
    alert_cooldown_temp = db.Column(db.Integer, default=120)
    alert_cooldown_tank = db.Column(db.Integer, default=60)
    alert_cooldown_rain = db.Column(db.Integer, default=720)
    alert_cooldown_water = db.Column(db.Integer, default=1440)

    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)

    sensors_data = db.relationship('SensorData', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    relays = db.relationship('Relay', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    rules = db.relationship('AutomationRule', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    alert_rules = db.relationship('AlertRule', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    commands = db.relationship('CommandLog', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password):
        self.password_hash = hashlib.sha256(password.encode()).hexdigest()

    def check_password(self, password):
        return self.password_hash == hashlib.sha256(password.encode()).hexdigest()

    def get_id(self):
        return str(self.id)

    def get_cooldown_for_alert_type(self, alert_type):
        cooldown_map = {
            'soil_moisture': self.alert_cooldown_soil,
            'temperature': self.alert_cooldown_temp,
            'tank_level': self.alert_cooldown_tank,
            'upcoming_rain': self.alert_cooldown_rain,
            'water_shortage': self.alert_cooldown_water
        }
        return cooldown_map.get(alert_type, 60)

    def calculate_soil_moisture_percent(self, raw_value):
        if raw_value is None:
            return None
        dry = self.soil_dry_raw if self.soil_dry_raw is not None else 3500
        wet = self.soil_wet_raw if self.soil_wet_raw is not None else 1500
        if dry <= wet:
            return None
        if raw_value >= dry:
            return 0.0
        elif raw_value <= wet:
            return 100.0
        else:
            percent = ((dry - raw_value) / (dry - wet)) * 100
            return round(percent, 1)


class SensorData(db.Model):
    __tablename__ = 'sensor_data'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=get_current_tehran_naive, index=True)

    temperature = db.Column(db.Float)
    humidity = db.Column(db.Float)
    soil_moisture_raw = db.Column(db.Integer)
    tank_distance_mm = db.Column(db.Float)

    soil_moisture = db.Column(db.Float)
    tank_level_percent = db.Column(db.Float)
    tank_liters = db.Column(db.Float)

    def calculate_tank(self, tank_height_mm, tank_capacity_liters):
        height = tank_height_mm if tank_height_mm is not None else 0
        capacity = tank_capacity_liters if tank_capacity_liters is not None else 0

        if self.tank_distance_mm is None or self.tank_distance_mm <= 0 or height <= 0:
            self.tank_level_percent = 0
            self.tank_liters = 0
        elif self.tank_distance_mm >= height:
            self.tank_level_percent = 0
            self.tank_liters = 0
        else:
            water_height = height - self.tank_distance_mm
            self.tank_level_percent = (water_height / height) * 100
            if self.tank_level_percent > 100:
                self.tank_level_percent = 100
            self.tank_liters = (self.tank_level_percent / 100) * capacity


class Relay(db.Model):
    __tablename__ = 'relays'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    name = db.Column(db.String(50), nullable=False)
    gpio = db.Column(db.Integer, nullable=False)
    state = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)

    __table_args__ = (
        db.CheckConstraint('gpio IN (12,13,14,15)', name='valid_gpio'),
    )

    automation_rules = db.relationship('AutomationRule', backref='relay', lazy='dynamic', cascade='all, delete-orphan')


class AutomationRule(db.Model):
    __tablename__ = 'automation_rules'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    relay_id = db.Column(db.Integer, db.ForeignKey('relays.id'), nullable=False)

    name = db.Column(db.String(100), nullable=False)
    active = db.Column(db.Boolean, default=True)

    rule_type = db.Column(db.String(20), nullable=False)  # moisture_below, moisture_above, schedule, and
    threshold = db.Column(db.Float)
    schedule_time = db.Column(db.String(5))
    schedule_action = db.Column(db.String(3))
    action_state = db.Column(db.Boolean, nullable=False)

    # فیلدهای جدید برای قانون ترکیبی (AND)
    condition_type = db.Column(db.String(10), default='single')  # single, and
    second_sensor_type = db.Column(db.String(30))  # soil_moisture, temperature, tank_level
    second_operator = db.Column(db.String(10))    # below, above
    second_threshold = db.Column(db.Float)

    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)
    last_triggered = db.Column(db.DateTime)

    def evaluate_moisture(self, current_moisture):
        if not self.active or current_moisture is None:
            return False
        if self.rule_type == 'moisture_below':
            return current_moisture < self.threshold
        elif self.rule_type == 'moisture_above':
            return current_moisture > self.threshold
        return False

    def evaluate_schedule(self, current_time):
        if not self.active or not self.schedule_time:
            return False
        return current_time.strftime("%H:%M") == self.schedule_time

    def evaluate_and_condition(self, current_soil, current_temp, current_tank):
        """ارزیابی قانون ترکیبی (AND) با دو شرط"""
        if not self.active:
            return False

        # شرط اول (همیشه رطوبت خاک)
        first_ok = False
        if self.rule_type == 'moisture_below':
            first_ok = current_soil < self.threshold
        elif self.rule_type == 'moisture_above':
            first_ok = current_soil > self.threshold
        else:
            return False

        if not first_ok:
            return False

        # شرط دوم
        second_value = None
        if self.second_sensor_type == 'soil_moisture':
            second_value = current_soil
        elif self.second_sensor_type == 'temperature':
            second_value = current_temp
        elif self.second_sensor_type == 'tank_level':
            second_value = current_tank

        if second_value is None:
            return False

        if self.second_operator == 'below':
            return second_value < self.second_threshold
        elif self.second_operator == 'above':
            return second_value > self.second_threshold
        return False


class AlertRule(db.Model):
    __tablename__ = 'alert_rules'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)

    name = db.Column(db.String(100), nullable=False)
    enabled = db.Column(db.Boolean, default=True)
    sensor_type = db.Column(db.String(30), nullable=False)
    operator = db.Column(db.String(10), nullable=False)
    threshold = db.Column(db.Float, nullable=False)
    sms_template = db.Column(db.String(500), nullable=False)
    last_sent_at = db.Column(db.DateTime)
    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)

    def evaluate(self, current_value):
        if not self.enabled or current_value is None:
            return False
        if self.operator == 'below':
            return current_value < self.threshold
        elif self.operator == 'above':
            return current_value > self.threshold
        return False

    def format_message(self, value, remaining_liters=None):
        msg = self.sms_template.replace('{value}', str(value))
        if remaining_liters is not None:
            msg = msg.replace('{remaining_liters}', str(int(remaining_liters)))
        return msg


class CommandLog(db.Model):
    __tablename__ = 'command_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    command_id = db.Column(db.String(36), nullable=False, unique=True)
    command_type = db.Column(db.String(20))
    payload = db.Column(db.Text)
    acknowledged = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)
    acknowledged_at = db.Column(db.DateTime)

    @staticmethod
    def generate_command_id():
        return str(uuid.uuid4())


class AvailableDeviceCode(db.Model):
    __tablename__ = 'available_device_codes'

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(50), unique=True, nullable=False)
    used = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=get_current_tehran_naive)


def create_default_user():
    if User.query.count() == 0:
        user = User(
            device_code='TEST-001',
            farm_name='مزرعه نمونه',
            latitude=35.6892,
            longitude=51.3890,
            phone_number='09123456789',
            soil_dry_raw=3500,
            soil_wet_raw=1500
        )
        user.set_password('123456')
        db.session.add(user)
        db.session.flush()

        relays_data = [('پمپ آبیاری', 12), ('فن گلخانه', 13), ('چراغ باغچه', 14), ('شیر برقی', 15)]
        for name, gpio in relays_data:
            relay = Relay(user_id=user.id, name=name, gpio=gpio, state=False)
            db.session.add(relay)
        db.session.flush()

        relay = Relay.query.filter_by(user_id=user.id, gpio=12).first()
        if relay:
            rule = AutomationRule(
                user_id=user.id,
                relay_id=relay.id,
                name='روشن شدن پمپ در رطوبت کم',
                rule_type='moisture_below',
                threshold=25,
                action_state=True,
                condition_type='single'
            )
            db.session.add(rule)

        alert_rule = AlertRule(
            user_id=user.id,
            name='هشدار رطوبت کم خاک',
            sensor_type='soil_moisture',
            operator='below',
            threshold=25,
            sms_template='هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.'
        )
        db.session.add(alert_rule)

        db.session.commit()
        print("کاربر پیش‌فرض با کد TEST-001 و رمز 123456 ایجاد شد.")