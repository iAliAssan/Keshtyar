export type User = {
  id: number;
  device_code: string;
  password_hash: string;
  farm_name: string;
  latitude: number;
  longitude: number;
  phone_number: string | null;
  tank_height_mm: number;
  tank_capacity_liters: number;
  soil_dry_raw: number;
  soil_wet_raw: number;
  alert_cooldown_soil: number;
  alert_cooldown_temp: number;
  alert_cooldown_tank: number;
  created_at: string;
};

export type SensorData = {
  id: number;
  user_id: number;
  timestamp: string;
  temperature: number | null;
  humidity: number | null;
  soil_moisture_raw: number | null;
  soil_moisture: number | null;
  tank_distance_mm: number | null;
  tank_level_percent: number | null;
  tank_liters: number | null;
};

export type Relay = {
  id: number;
  user_id: number;
  name: string;
  gpio: number;
  state: boolean;
  created_at: string;
};

export type AutomationRule = {
  id: number;
  user_id: number;
  relay_id: number;
  name: string;
  active: boolean;
  rule_type: string;
  threshold: number | null;
  schedule_time: string | null;
  action_state: boolean;
  condition_type: 'single' | 'and';
  second_sensor_type: string | null;
  second_operator: string | null;
  second_threshold: number | null;
  last_triggered: string | null;
  created_at: string;
};

export type AlertRule = {
  id: number;
  user_id: number;
  name: string;
  enabled: boolean;
  sensor_type: string;
  operator: string;
  threshold: number;
  sms_template: string;
  last_sent_at: string | null;
  created_at: string;
};

export type CommandLog = {
  id: number;
  user_id: number;
  command_id: string;
  command_type: string;
  payload: string;
  acknowledged: boolean;
  created_at: string;
  acknowledged_at: string | null;
};

export type WeatherForecast = {
  current: { temperature: number; rain: number; wind: number; uv_index: number };
  today: { temp_max: number; temp_min: number; rain: number };
  tomorrow: { temp_max: number; temp_min: number; rain: number };
  next_3_days: { temp_max: number; temp_min: number; total_rain: number };
};

export type FarmStatus = 'excellent' | 'good' | 'warning' | 'critical';
