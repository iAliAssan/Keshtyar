import { FARM_STATUS_THRESHOLDS } from '@/config';
import { FarmStatus, WeatherForecast } from '@/types';

export const getCurrentTehran = (): Date => {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Tehran' }));
};

export const formatPersianDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('fa-IR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const calculateSoilMoisturePercent = (
  rawValue: number | null,
  dryRaw: number,
  wetRaw: number
): number | null => {
  if (rawValue === null) return null;
  if (dryRaw <= wetRaw) return null;
  if (rawValue >= dryRaw) return 0;
  if (rawValue <= wetRaw) return 100;
  return Number((((dryRaw - rawValue) / (dryRaw - wetRaw)) * 100).toFixed(1));
};

export const calculateTankLevel = (
  distanceMm: number | null,
  tankHeightMm: number,
  tankCapacityLiters: number
): { percent: number; liters: number } => {
  if (!distanceMm || distanceMm <= 0 || tankHeightMm <= 0) {
    return { percent: 0, liters: 0 };
  }
  if (distanceMm >= tankHeightMm) {
    return { percent: 0, liters: 0 };
  }
  const waterHeight = tankHeightMm - distanceMm;
  const percent = (waterHeight / tankHeightMm) * 100;
  const liters = (percent / 100) * tankCapacityLiters;
  return { percent: Math.min(100, percent), liters };
};

export const getFarmStatus = (
  soilMoisture: number,
  temperature: number,
  tankLevel: number
): FarmStatus => {
  const t = FARM_STATUS_THRESHOLDS;
  if (soilMoisture >= t.excellent.soilMin && temperature <= t.excellent.tempMax && tankLevel >= t.excellent.tankMin)
    return 'excellent';
  if (soilMoisture >= t.good.soilMin && temperature <= t.good.tempMax && tankLevel >= t.good.tankMin)
    return 'good';
  if (soilMoisture >= t.warning.soilMin && temperature <= t.warning.tempMax && tankLevel >= t.warning.tankMin)
    return 'warning';
  return 'critical';
};

export const getFarmStatusText = (status: FarmStatus): string => {
  const map = { excellent: 'عالی', good: 'خوب', warning: 'هشدار', critical: 'بحرانی' };
  return map[status];
};

export const generateIrrigationRecommendation = (
  soilMoisture: number,
  forecast: WeatherForecast | null,
  tankLevel: number
): string => {
  if (tankLevel < 15) return `سطح تانک بسیار پایین است (${Math.round(tankLevel)}%). لطفاً سریعاً تانک را پر کنید.`;
  
  let rainComing = false;
  let rainDays = 0;
  if (forecast) {
    if (forecast.today.rain > 5) { rainComing = true; rainDays = 1; }
    else if (forecast.tomorrow.rain > 5) { rainComing = true; rainDays = 2; }
    else if (forecast.next_3_days.total_rain > 10) { rainComing = true; rainDays = 3; }
  }
  
  if (soilMoisture < 30) {
    if (rainComing && soilMoisture >= 20) return 'با توجه به پیش‌بینی بارندگی در روزهای آینده، توصیه می‌شود آبیاری به تعویق بیفتد.';
    return `رطوبت خاک پایین است (${Math.round(soilMoisture)}%). آبیاری توصیه می‌شود.`;
  }
  if (soilMoisture >= 30 && soilMoisture < 50) {
    if (rainComing) return 'با توجه به پیش‌بینی بارندگی، آبیاری را به تعویق بیندازید.';
    return `رطوبت خاک در حد قابل قبول است (${Math.round(soilMoisture)}%). در ۲۴ ساعت آینده نیاز به آبیاری نیست.`;
  }
  return `رطوبت خاک در حد مطلوب (${Math.round(soilMoisture)}%) است. نیاز به آبیاری نیست.`;
};

export const evaluateRule = (
  rule: any,
  soil: number,
  temp: number | null,
  tank: number | null,
  currentTime: Date
): boolean => {
  if (!rule.active) return false;
  
  // Time-based rule
  if (rule.rule_type === 'schedule' && rule.schedule_time) {
    const now = `${currentTime.getHours().toString().padStart(2,'0')}:${currentTime.getMinutes().toString().padStart(2,'0')}`;
    return now === rule.schedule_time;
  }
  
  // AND condition
  if (rule.condition_type === 'and') {
    let firstOk = false;
    if (rule.rule_type === 'moisture_below') firstOk = soil < rule.threshold;
    else if (rule.rule_type === 'moisture_above') firstOk = soil > rule.threshold;
    if (!firstOk) return false;
    
    const secondValue = rule.second_sensor_type === 'temperature' ? temp : tank;
    if (secondValue === null) return false;
    if (rule.second_operator === 'below') return secondValue < rule.second_threshold;
    if (rule.second_operator === 'above') return secondValue > rule.second_threshold;
    return false;
  }
  
  // Simple rule
  const parts = rule.rule_type.split('_');
  if (parts.length < 2) return false;
  const sensor = parts[0];
  const operator = parts[1];
  
  let value: number | null = null;
  if (sensor === 'soil_moisture') value = soil;
  else if (sensor === 'temperature') value = temp;
  else if (sensor === 'tank_level') value = tank;
  if (value === null) return false;
  
  if (operator === 'below') return value < rule.threshold;
  if (operator === 'above') return value > rule.threshold;
  if (operator === 'equal') return Math.abs(value - rule.threshold) < 0.01;
  if (operator === 'not_equal') return Math.abs(value - rule.threshold) > 0.01;
  return false;
};

export const checkAlertRule = (rule: any, value: number): boolean => {
  if (!rule.enabled) return false;
  if (rule.operator === 'below') return value < rule.threshold;
  if (rule.operator === 'above') return value > rule.threshold;
  if (rule.operator === 'equal') return Math.abs(value - rule.threshold) < 0.01;
  if (rule.operator === 'not_equal') return Math.abs(value - rule.threshold) > 0.01;
  return false;
};
