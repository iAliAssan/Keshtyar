'use client';

import { useEffect, useState } from 'react';
import { useAuth, Card, Button } from '@/components';
import { SITE_CONFIG } from '@/config';

export default function DeviceConfigPage() {
  const { user } = useAuth();
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [status, setStatus] = useState<'online' | 'offline' | 'waiting'>('waiting');

  useEffect(() => {
    const checkStatus = async () => {
      const res = await fetch('/api/last-sensor');
      const data = await res.json();
      if (data.lastUpdate) {
        setLastUpdate(data.lastUpdate);
        const diff = (Date.now() - new Date(data.lastUpdate).getTime()) / 60000;
        setStatus(diff < 5 ? 'online' : 'offline');
      } else {
        setStatus('waiting');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const apiUrl = `${window.location.origin}/api/sensor`;
  const deviceCode = user?.device_code || '';

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('کپی شد!');
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold"><i className="fas fa-microchip ml-2 text-[#9CB080]"></i>تنظیمات دستگاه ESP32</h3>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h5 className="font-bold mb-4">اطلاعات اتصال به سرور</h5>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">آدرس API</label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm break-all">{apiUrl}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(apiUrl)}><i className="fas fa-copy"></i></Button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-[var(--text-secondary)] mb-1">کد یکتا دستگاه</label>
              <div className="flex gap-2">
                <code className="flex-1 p-2 rounded-lg bg-[var(--bg-secondary)] text-sm font-mono tracking-wider">{deviceCode}</code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(deviceCode)}><i className="fas fa-copy"></i></Button>
              </div>
            </div>
          </div>
          <div className="mt-6 p-3 rounded-xl bg-yellow-500/10 text-yellow-500 text-sm">
            <i className="fas fa-exclamation-triangle ml-1"></i> این کد یکتا منحصر به فرد است. آن را با کسی به اشتراک نگذارید.
          </div>
        </Card>

        <Card className="p-6">
          <h5 className="font-bold mb-4">وضعیت اتصال دستگاه</h5>
          <div className="text-center py-4">
            {status === 'online' && (
              <div className="text-green-500">
                <i className="fas fa-check-circle text-5xl mb-2"></i>
                <p>دستگاه متصل است</p>
                <p className="text-sm text-[var(--text-secondary)]">آخرین بروزرسانی: {lastUpdate ? new Date(lastUpdate).toLocaleString('fa-IR') : '---'}</p>
              </div>
            )}
            {status === 'offline' && (
              <div className="text-yellow-500">
                <i className="fas fa-exclamation-triangle text-5xl mb-2"></i>
                <p>ارتباط قطع است</p>
                <p className="text-sm text-[var(--text-secondary)]">آخرین بروزرسانی: {lastUpdate ? new Date(lastUpdate).toLocaleString('fa-IR') : '---'}</p>
              </div>
            )}
            {status === 'waiting' && (
              <div className="text-[var(--text-secondary)]">
                <i className="fas fa-microchip text-5xl mb-2"></i>
                <p>در انتظار دریافت داده</p>
                <p className="text-sm">هنوز داده‌ای از دستگاه دریافت نشده است.</p>
              </div>
            )}
          </div>
        </Card>

        <Card className="lg:col-span-2 p-6">
          <h5 className="font-bold mb-3">کد نمونه MicroPython</h5>
          <pre className="p-4 rounded-xl bg-[#1e1e2e] text-green-400 text-xs overflow-x-auto">
{`# config.py - تنظیمات ESP32
SERVER_URL = "${apiUrl}"
DEVICE_CODE = "${deviceCode}"
WIFI_SSID = "your_wifi"
WIFI_PASSWORD = "your_password"
SEND_INTERVAL = 60  # seconds

# سنسورها
SOIL_ADC_PIN = 4
TANK_TRIG_PIN = 5
TANK_ECHO_PIN = 6
RELAY_GPIO_LIST = [12, 13, 14, 15]`}
          </pre>
          <Button variant="outline" className="mt-3" onClick={() => copyToClipboard(`SERVER_URL="${apiUrl}"\nDEVICE_CODE="${deviceCode}"`)}>
            <i className="fas fa-copy ml-1"></i> کپی تنظیمات
          </Button>
        </Card>
      </div>
    </div>
  );
}
