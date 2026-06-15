'use client';

import { useEffect, useState } from 'react';
import { useAuth, Card, WeatherForecast, FarmStatusCard, LineChart } from '@/components';
import { createClient } from '@/lib/supabase';
import { getFarmStatus, getFarmStatusText, generateIrrigationRecommendation, getCurrentTehran, formatPersianDate } from '@/lib/utils';
import type { SensorData, WeatherForecast as WeatherType } from '@/types';

export default function DashboardPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [lastSensor, setLastSensor] = useState<SensorData | null>(null);
  const [forecast, setForecast] = useState<WeatherType | null>(null);
  const [hourlyData, setHourlyData] = useState<any>(null);
  const [chartData, setChartData] = useState<{ timestamps: string[]; values: number[] }>({ timestamps: [], values: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchData = async () => {
    if (!user) return;
    
    // Last sensor data
    const { data: sensorData } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(1);
    setLastSensor(sensorData?.[0] || null);
    
    // Chart data (last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const { data: historyData } = await supabase
      .from('sensor_data')
      .select('timestamp, soil_moisture')
      .eq('user_id', user.id)
      .gte('timestamp', yesterday.toISOString())
      .order('timestamp', { ascending: true });
    
    if (historyData) {
      setChartData({
        timestamps: historyData.map(d => formatPersianDate(d.timestamp).slice(0, 16)),
        values: historyData.map(d => d.soil_moisture ?? 0),
      });
    }
    
    // Weather forecast
    try {
      const res = await fetch(`/api/weather?lat=${user.latitude}&lon=${user.longitude}`);
      const weatherData = await res.json();
      if (weatherData.success) {
        setForecast(weatherData.forecast);
        setHourlyData(weatherData.hourly);
      }
    } catch (e) { console.error(e); }
    
    setLoading(false);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><i className="fas fa-spinner fa-spin text-3xl text-[#9CB080]"></i></div>;
  }

  const soil = lastSensor?.soil_moisture ?? 0;
  const temp = lastSensor?.temperature ?? 0;
  const tank = lastSensor?.tank_level_percent ?? 0;
  const status = getFarmStatus(soil, temp, tank);
  const statusText = getFarmStatusText(status);
  const recommendation = generateIrrigationRecommendation(soil, forecast, tank);

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="p-5 rounded-2xl bg-gradient-to-r from-[#9CB080]/20 to-transparent">
        <h2 className="text-xl font-bold"><i className="fas fa-tractor ml-2"></i>خوش آمدید، {user?.farm_name}</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-1"><i className="fas fa-calendar-alt ml-1"></i>{getCurrentTehran().toLocaleDateString('fa-IR')}</p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'دما', value: temp ? `${temp.toFixed(1)}°C` : '---', icon: 'fas fa-thermometer-half', color: '#ef4444' },
          { label: 'رطوبت هوا', value: lastSensor?.humidity ? `${lastSensor.humidity.toFixed(1)}%` : '---', icon: 'fas fa-tint', color: '#3b82f6' },
          { label: 'رطوبت خاک', value: soil ? `${soil.toFixed(1)}%` : '---', icon: 'fas fa-seedling', color: '#9CB080' },
          { label: 'سطح تانک', value: tank ? `${tank.toFixed(1)}%` : '---', icon: 'fas fa-water', color: '#06b6d4' },
        ].map((stat, i) => (
          <Card key={i} className="p-4 text-center">
            <i className={`${stat.icon} text-2xl mb-2`} style={{ color: stat.color }}></i>
            <p className="text-[var(--text-secondary)] text-sm">{stat.label}</p>
            <p className="text-xl font-bold">{stat.value}</p>
          </Card>
        ))}
      </div>
      
      {/* Farm Status & Recommendation */}
      <div className="grid md:grid-cols-3 gap-4">
        <FarmStatusCard status={status} text={statusText} />
        <Card className="md:col-span-2 p-5">
          <h5 className="font-bold mb-2"><i className="fas fa-tint ml-1 text-[#9CB080]"></i>توصیه آبیاری</h5>
          <p className="text-[var(--text-secondary)] leading-relaxed">{recommendation}</p>
        </Card>
      </div>
      
      {/* Weather & Chart */}
      <div className="grid lg:grid-cols-2 gap-6">
        <WeatherForecast forecast={forecast} hourlyData={hourlyData} />
        <LineChart data={{ ...chartData, label: 'رطوبت خاک (%)', color: 'rgba(156, 176, 128, 0.1)', borderColor: '#9CB080', maxY: 100 }} title="تغییرات رطوبت خاک (۲۴ ساعت گذشته)" />
      </div>
    </div>
  );
}
