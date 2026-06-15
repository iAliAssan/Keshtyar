'use client';

import { useEffect, useState } from 'react';
import { useAuth, LineChart } from '@/components';
import { createClient } from '@/lib/supabase';
import { formatPersianDate } from '@/lib/utils';

type HistoryData = {
  timestamps: string[];
  soil_moisture: number[];
  temperature: number[];
  tank_level: number[];
};

export default function HistoryPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [days, setDays] = useState(7);
  const [data, setData] = useState<HistoryData>({ timestamps: [], soil_moisture: [], temperature: [], tank_level: [] });
  const [loading, setLoading] = useState(true);
  const [tableData, setTableData] = useState<any[]>([]);

  useEffect(() => {
    if (user) fetchData();
  }, [user, days]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const { data: sensorData } = await supabase
      .from('sensor_data')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });
    
    if (sensorData) {
      setData({
        timestamps: sensorData.map(d => formatPersianDate(d.timestamp)),
        soil_moisture: sensorData.map(d => d.soil_moisture ?? 0),
        temperature: sensorData.map(d => d.temperature ?? 0),
        tank_level: sensorData.map(d => d.tank_level_percent ?? 0),
      });
      setTableData(sensorData.slice(-50));
    }
    setLoading(false);
  };

  const avg = (arr: number[]) => arr.filter(v => v > 0).reduce((a, b) => a + b, 0) / arr.filter(v => v > 0).length || 0;

  if (loading) return <div className="flex justify-center py-12"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold"><i className="fas fa-chart-line ml-2 text-[#9CB080]"></i>تاریخچه داده‌ها</h3>
        <div className="flex gap-2">
          {[1, 7, 30].map(d => (
            <button key={d} onClick={() => setDays(d)} className={`px-4 py-2 rounded-xl transition-all ${days === d ? 'bg-[#9CB080] text-white' : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)]'}`}>
              {d === 1 ? '۲۴ ساعت' : d === 7 ? '۷ روز' : '۳۰ روز'}
            </button>
          ))}
        </div>
      </div>
      
      <div className="grid gap-6">
        <LineChart data={{ timestamps: data.timestamps, values: data.soil_moisture, label: 'رطوبت خاک (%)', color: 'rgba(156, 176, 128, 0.1)', borderColor: '#9CB080', maxY: 100 }} title="نمودار رطوبت خاک" />
        <LineChart data={{ timestamps: data.timestamps, values: data.temperature, label: 'دما (°C)', color: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', maxY: undefined }} title="نمودار دما" />
        <LineChart data={{ timestamps: data.timestamps, values: data.tank_level, label: 'سطح تانک (%)', color: 'rgba(6, 182, 212, 0.1)', borderColor: '#06b6d4', maxY: 100 }} title="نمودار سطح تانک" />
      </div>
      
      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'میانگین رطوبت خاک', value: avg(data.soil_moisture).toFixed(1), unit: '%' },
          { label: 'میانگین دما', value: avg(data.temperature).toFixed(1), unit: '°C' },
          { label: 'میانگین سطح تانک', value: avg(data.tank_level).toFixed(1), unit: '%' },
        ].map((stat, i) => (
          <div key={i} className="p-4 rounded-xl bg-[var(--card-bg)] text-center">
            <p className="text-[var(--text-secondary)] text-sm">{stat.label}</p>
            <p className="text-2xl font-bold">{stat.value} <span className="text-sm">{stat.unit}</span></p>
          </div>
        ))}
      </div>
      
      {/* Data Table */}
      <div className="rounded-xl overflow-hidden border border-[var(--border-color)]">
        <div className="overflow-x-auto max-h-96">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--bg-secondary)]">
              <tr>{['زمان', 'دما', 'رطوبت خاک', 'سطح تانک'].map(h => <th key={h} className="p-3 text-right">{h}</th>)}</tr>
            </thead>
            <tbody>
              {tableData.map((row, i) => (
                <tr key={i} className="border-t border-[var(--border-color)]">
                  <td className="p-3">{formatPersianDate(row.timestamp)}</td>
                  <td className="p-3">{row.temperature?.toFixed(1) ?? '---'}°C</td>
                  <td className="p-3">{row.soil_moisture?.toFixed(1) ?? '---'}%</td>
                  <td className="p-3">{row.tank_level_percent?.toFixed(1) ?? '---'}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
