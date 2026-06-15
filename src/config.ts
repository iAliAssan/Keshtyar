export const SITE_CONFIG = {
  name: 'کشتیار',
  brand: 'AURON',
  tagline: 'Intelligent Systems',
  website: 'auron.ir',
  supportPhone: '۰۲۱-۱۲۳۴۵۶۷۸',
  supportText: 'برای بازیابی رمز عبور با پشتیبانی تماس بگیرید',
};

export const DEFAULT_COORDS = {
  lat: 35.6892,
  lon: 51.3890,
};

export const TANK_DEFAULTS = {
  heightMm: 1000,
  capacityLiters: 10000,
};

export const SOIL_CALIBRATION_DEFAULTS = {
  dryRaw: 3500,
  wetRaw: 1500,
};

export const ALERT_COOLDOWN_DEFAULTS = {
  soil_moisture: 60,
  temperature: 120,
  tank_level: 60,
  upcoming_rain: 720,
  water_shortage: 1440,
};

export const FARM_STATUS_THRESHOLDS = {
  excellent: { soilMin: 60, tempMax: 32, tankMin: 70 },
  good: { soilMin: 40, tempMax: 38, tankMin: 40 },
  warning: { soilMin: 25, tempMax: 42, tankMin: 20 },
};

export const ALLOWED_GPIO = [12, 13, 14, 15];
