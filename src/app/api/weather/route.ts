
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ success: false, message: 'lat and lon required' }, { status: 400 });
  }

  try {
    // Daily forecast
    const dailyRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,rain_sum,windspeed_10m_max,uv_index_max&timezone=auto&forecast_days=3`
    );
    const dailyData = await dailyRes.json();

    // Hourly forecast
    const hourlyRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m&timezone=auto&forecast_days=3`
    );
    const hourlyData = await hourlyRes.json();

    const daily = dailyData.daily || {};
    const hourly = hourlyData.hourly || {};

    const forecast = {
      current: {
        temperature: daily.temperature_2m_max?.[0] || 0,
        rain: daily.rain_sum?.[0] || 0,
        wind: daily.windspeed_10m_max?.[0] || 0,
        uv_index: daily.uv_index_max?.[0] || 0,
      },
      today: {
        temp_max: daily.temperature_2m_max?.[0] || 0,
        temp_min: daily.temperature_2m_min?.[0] || 0,
        rain: daily.rain_sum?.[0] || 0,
      },
      tomorrow: {
        temp_max: daily.temperature_2m_max?.[1] || 0,
        temp_min: daily.temperature_2m_min?.[1] || 0,
        rain: daily.rain_sum?.[1] || 0,
      },
      next_3_days: {
        temp_max: Math.max(...(daily.temperature_2m_max?.slice(1, 4) || [0])),
        temp_min: Math.min(...(daily.temperature_2m_min?.slice(1, 4) || [0])),
        total_rain: (daily.rain_sum?.slice(1, 4).reduce((a: number, b: number) => a + b, 0) || 0),
      },
    };

    // Group hourly data by day
    const hourlyGrouped: Record<string, any[]> = {};
    const times = hourly.time || [];
    const temps = hourly.temperature_2m || [];
    const hums = hourly.relative_humidity_2m || [];

    for (let i = 0; i < times.length; i++) {
      const date = times[i].split('T')[0];
      if (!hourlyGrouped[date]) hourlyGrouped[date] = [];
      hourlyGrouped[date].push({
        time: times[i].slice(11, 16),
        temp: Math.round(temps[i]),
        humidity: Math.round(hums[i]),
      });
    }

    return NextResponse.json({ success: true, forecast, hourly: hourlyGrouped });
  } catch (error) {
    return NextResponse.json({ success: false, message: String(error) }, { status: 500 });
  }
}
