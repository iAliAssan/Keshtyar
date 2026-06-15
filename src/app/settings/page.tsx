'use client';

import { useEffect, useState } from 'react';
import { useAuth, Button, Card, Input, Select } from '@/components';
import { createClient } from '@/lib/supabase';
import { DEFAULT_COORDS, TANK_DEFAULTS, SOIL_CALIBRATION_DEFAULTS, ALERT_COOLDOWN_DEFAULTS } from '@/config';
import { calculateSoilMoisturePercent } from '@/lib/utils';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [calibMessage, setCalibMessage] = useState('');
  const [lastRawValue, setLastRawValue] = useState<number | null>(null);
  
  const [form, setForm] = useState({
    farm_name: '',
    phone_number: '',
    latitude: DEFAULT_COORDS.lat,
    longitude: DEFAULT_COORDS.lon,
    tank_height_mm: TANK_DEFAULTS.heightMm,
    tank_capacity_liters: TANK_DEFAULTS.capacityLiters,
    soil_dry_raw: SOIL_CALIBRATION_DEFAULTS.dryRaw,
    soil_wet_raw: SOIL_CALIBRATION_DEFAULTS.wetRaw,
    alert_cooldown_soil: ALERT_COOLDOWN_DEFAULTS.soil_moisture,
    alert_cooldown_temp: ALERT_COOLDOWN_DEFAULTS.temperature,
    alert_cooldown_tank: ALERT_COOLDOWN_DEFAULTS.tank_level,
  });
  
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    new_password_confirm: '',
  });

  useEffect(() => {
    if (user) {
      setForm({
        farm_name: user.farm_name || '',
        phone_number: user.phone_number || '',
        latitude: user.latitude || DEFAULT_COORDS.lat,
        longitude: user.longitude || DEFAULT_COORDS.lon,
        tank_height_mm: user.tank_height_mm || TANK_DEFAULTS.heightMm,
        tank_capacity_liters: user.tank_capacity_liters || TANK_DEFAULTS.capacityLiters,
        soil_dry_raw: user.soil_dry_raw || SOIL_CALIBRATION_DEFAULTS.dryRaw,
        soil_wet_raw: user.soil_wet_raw || SOIL_CALIBRATION_DEFAULTS.wetRaw,
        alert_cooldown_soil: user.alert_cooldown_soil || ALERT_COOLDOWN_DEFAULTS.soil_moisture,
        alert_cooldown_temp: user.alert_cooldown_temp || ALERT_COOLDOWN_DEFAULTS.temperature,
        alert_cooldown_tank: user.alert_cooldown_tank || ALERT_COOLDOWN_DEFAULTS.tank_level,
      });
      
      // Get last sensor raw value for calibration
      const fetchLastRaw = async () => {
        const { data } = await supabase
          .from('sensor_data')
          .select('soil_moisture_raw')
          .eq('user_id', user.id)
          .order('timestamp', { ascending: false })
          .limit(1);
        if (data && data[0]) setLastRawValue(data[0].soil_moisture_raw);
      };
      fetchLastRaw();
    }
  }, [user]);

  const getLocation = () => {
    if (!navigator.geolocation) return alert('مرورگر شما پشتیبانی نمی‌کند');
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm({ ...form, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => alert('خطا در دریافت موقعیت')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await supabase
      .from('users')
      .update({
        farm_name: form.farm_name,
        phone_number: form.phone_number,
        latitude: form.latitude,
        longitude: form.longitude,
        tank_height_mm: form.tank_height_mm,
        tank_capacity_liters: form.tank_capacity_liters,
        soil_dry_raw: form.soil_dry_raw,
        soil_wet_raw: form.soil_wet_raw,
        alert_cooldown_soil: form.alert_cooldown_soil,
        alert_cooldown_temp: form.alert_cooldown_temp,
        alert_cooldown_tank: form.alert_cooldown_tank,
      })
      .eq('id', user?.id);
    await refreshUser();
    setLoading(false);
    alert('تنظیمات با موفقیت ذخیره شد');
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.new_password_confirm) {
      alert('رمز عبور جدید و تکرار آن مطابقت ندارند');
      return;
    }
    if (passwordForm.new_password.length < 4) {
      alert('رمز عبور جدید باید حداقل ۴ کاراکتر باشد');
      return;
    }
    
    // Verify old password
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passwordForm.old_password));
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hashHex !== user?.password_hash) {
      alert('رمز عبور فعلی اشتباه است');
      return;
    }
    
    const newHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(passwordForm.new_password));
    const newHashHex = Array.from(new Uint8Array(newHash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    await supabase.from('users').update({ password_hash: newHashHex }).eq('id', user?.id);
    setPasswordForm({ old_password: '', new_password: '', new_password_confirm: '' });
    alert('رمز عبور با موفقیت تغییر کرد');
  };

  const calibrate = async (type: 'dry' | 'wet') => {
    if (lastRawValue === null) {
      setCalibMessage('هیچ داده رطوبت خاکی موجود نیست. لطفاً ابتدا سنسور را متصل کنید.');
      setTimeout(() => setCalibMessage(''), 3000);
      return;
    }
    
    if (type === 'dry') {
      await supabase.from('users').update({ soil_dry_raw: lastRawValue }).eq('id', user?.id);
      setForm({ ...form, soil_dry_raw: lastRawValue });
      setCalibMessage(`مقدار خشک (هوا) با موفقیت ثبت شد: ${lastRawValue}`);
    } else {
      await supabase.from('users').update({ soil_wet_raw: lastRawValue }).eq('id', user?.id);
      setForm({ ...form, soil_wet_raw: lastRawValue });
      setCalibMessage(`مقدار مرطوب (آب) با موفقیت ثبت شد: ${lastRawValue}`);
    }
    await refreshUser();
    setTimeout(() => setCalibMessage(''), 3000);
  };

  return (
    <div className="space-y-6">
      <h3 className="text-xl font-bold"><i className="fas fa-user-cog ml-2 text-[#9CB080]"></i>تنظیمات حساب کاربری</h3>
      
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Main Settings Form */}
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <h5 className="font-bold mb-3"><i className="fas fa-info-circle ml-1"></i> اطلاعات مزرعه</h5>
            <Input label="نام مزرعه" value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })} />
            <Input label="شماره موبایل (برای هشدارها)" placeholder="09123456789" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            
            <div className="flex gap-2">
              <Input label="عرض جغرافیایی" type="number" step="any" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })} />
              <Input label="طول جغرافیایی" type="number" step="any" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })} />
            </div>
            <Button type="button" variant="outline" onClick={getLocation} className="w-full"><i className="fas fa-crosshairs ml-1"></i> دریافت موقعیت خودکار</Button>
            
            <hr className="border-[var(--border-color)] my-4" />
            <h5 className="font-bold mb-3"><i className="fas fa-water ml-1"></i> تنظیمات تانک آب</h5>
            <div className="flex gap-2">
              <Input label="ارتفاع تانک (میلی‌متر)" type="number" value={form.tank_height_mm} onChange={(e) => setForm({ ...form, tank_height_mm: parseFloat(e.target.value) })} />
              <Input label="ظرفیت تانک (لیتر)" type="number" value={form.tank_capacity_liters} onChange={(e) => setForm({ ...form, tank_capacity_liters: parseFloat(e.target.value) })} />
            </div>
            
            <hr className="border-[var(--border-color)] my-4" />
            <h5 className="font-bold mb-3"><i className="fas fa-seedling ml-1"></i> کالیبراسیون رطوبت خاک</h5>
            <p className="text-xs text-[var(--text-secondary)] mb-3">مقدار خام آخرین داده: {lastRawValue ?? '---'}</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => calibrate('dry')} className="flex-1">تنظیم مقدار خشک</Button>
              <Button type="button" variant="outline" onClick={() => calibrate('wet')} className="flex-1">تنظیم مقدار مرطوب</Button>
            </div>
            <div className="flex gap-2">
              <Input label="مقدار خشک (هوا)" type="number" value={form.soil_dry_raw} onChange={(e) => setForm({ ...form, soil_dry_raw: parseInt(e.target.value) })} />
              <Input label="مقدار مرطوب (آب)" type="number" value={form.soil_wet_raw} onChange={(e) => setForm({ ...form, soil_wet_raw: parseInt(e.target.value) })} />
            </div>
            {calibMessage && <p className="text-green-500 text-sm">{calibMessage}</p>}
            
            <hr className="border-[var(--border-color)] my-4" />
            <h5 className="font-bold mb-3"><i className="fas fa-clock ml-1"></i> زمان خنک‌کنندگی هشدارها (دقیقه)</h5>
            <div className="flex gap-2">
              <Input label="رطوبت خاک" type="number" value={form.alert_cooldown_soil} onChange={(e) => setForm({ ...form, alert_cooldown_soil: parseInt(e.target.value) })} />
              <Input label="دما" type="number" value={form.alert_cooldown_temp} onChange={(e) => setForm({ ...form, alert_cooldown_temp: parseInt(e.target.value) })} />
              <Input label="سطح تانک" type="number" value={form.alert_cooldown_tank} onChange={(e) => setForm({ ...form, alert_cooldown_tank: parseInt(e.target.value) })} />
            </div>
            
            <Button type="submit" loading={loading} className="w-full">ذخیره تنظیمات</Button>
          </form>
        </Card>
        
        {/* Password & Info Card */}
        <div className="space-y-6">
          <Card className="p-6">
            <h5 className="font-bold mb-4"><i className="fas fa-lock ml-1"></i> تغییر رمز عبور</h5>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input label="رمز عبور فعلی" type="password" value={passwordForm.old_password} onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })} />
              <Input label="رمز عبور جدید" type="password" value={passwordForm.new_password} onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })} />
              <Input label="تکرار رمز عبور جدید" type="password" value={passwordForm.new_password_confirm} onChange={(e) => setPasswordForm({ ...passwordForm, new_password_confirm: e.target.value })} />
              <Button type="submit" variant="warning" className="w-full">تغییر رمز عبور</Button>
            </form>
          </Card>
          
          <Card className="p-6">
            <h5 className="font-bold mb-3"><i className="fas fa-microchip ml-1"></i> اطلاعات دستگاه</h5>
            <p className="text-sm"><span className="text-[var(--text-secondary)]">کد یکتا:</span> <code className="font-mono">{user?.device_code}</code></p>
            <p className="text-sm mt-2"><span className="text-[var(--text-secondary)]">تاریخ عضویت:</span> {user?.created_at ? new Date(user.created_at).toLocaleDateString('fa-IR') : '---'}</p>
            <hr className="border-[var(--border-color)] my-3" />
            <a href="/device-config" className="block"><Button variant="outline" className="w-full">تنظیمات دستگاه ESP32</Button></a>
          </Card>
        </div>
      </div>
    </div>
  );
}
