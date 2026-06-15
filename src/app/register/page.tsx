'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components';
import { createClient } from '@/lib/supabase';
import { DEFAULT_COORDS, TANK_DEFAULTS, SOIL_CALIBRATION_DEFAULTS, SITE_CONFIG } from '@/config';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    device_code: '',
    password: '',
    password_confirm: '',
    farm_name: 'مزرعه من',
    phone_number: '',
    latitude: DEFAULT_COORDS.lat,
    longitude: DEFAULT_COORDS.lon,
  });
  const [error, setError] = useState('');

  const getLocation = () => {
    if (!navigator.geolocation) return alert('مرورگر شما پشتیبانی نمی‌کند');
    navigator.geolocation.getCurrentPosition(
      (pos) => setForm({ ...form, latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => alert('خطا در دریافت موقعیت')
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) {
      setError('رمز عبور و تکرار آن مطابقت ندارند');
      return;
    }
    if (form.password.length < 4) {
      setError('رمز عبور باید حداقل ۴ کاراکتر باشد');
      return;
    }
    if (form.device_code.length !== 8) {
      setError('کد یکتا باید ۸ کاراکتر باشد');
      return;
    }
    
    setLoading(true);
    const supabase = createClient();
    
    // Check if device code exists
    const { data: existing } = await supabase
      .from('available_device_codes')
      .select('code')
      .eq('code', form.device_code.toUpperCase())
      .eq('used', false)
      .single();
    
    if (!existing) {
      setError('کد یکتا معتبر نیست یا قبلاً استفاده شده است');
      setLoading(false);
      return;
    }
    
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.password));
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    const { data: user, error: userError } = await supabase
      .from('users')
      .insert({
        device_code: form.device_code.toUpperCase(),
        password_hash: hashHex,
        farm_name: form.farm_name,
        phone_number: form.phone_number,
        latitude: form.latitude,
        longitude: form.longitude,
        tank_height_mm: TANK_DEFAULTS.heightMm,
        tank_capacity_liters: TANK_DEFAULTS.capacityLiters,
        soil_dry_raw: SOIL_CALIBRATION_DEFAULTS.dryRaw,
        soil_wet_raw: SOIL_CALIBRATION_DEFAULTS.wetRaw,
      })
      .select()
      .single();
    
    if (userError) {
      setError('خطا در ثبت‌نام: ' + userError.message);
      setLoading(false);
      return;
    }
    
    await supabase.from('available_device_codes').update({ used: true }).eq('code', form.device_code);
    await supabase.auth.signInWithPassword({
      email: `${user.id}@keshtyar.local`,
      password: form.password,
    });
    
    router.push('/dashboard');
  };

  return (
    <Card className="p-6">
      <div className="text-center mb-6">
        <i className="fas fa-user-plus text-4xl text-[#9CB080]"></i>
        <h2 className="text-xl font-bold mt-2">ثبت‌نام در کشتیار</h2>
      </div>
      
      <form onSubmit={handleSubmit}>
        {step === 1 && (
          <>
            <Input label="کد یکتا دستگاه (۸ کاراکتر)" placeholder="A7B3F9G2" value={form.device_code} onChange={(e) => setForm({ ...form, device_code: e.target.value.toUpperCase() })} required />
            <Input label="رمز عبور" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Input label="تکرار رمز عبور" type="password" value={form.password_confirm} onChange={(e) => setForm({ ...form, password_confirm: e.target.value })} required />
            <Button type="button" onClick={() => setStep(2)} className="w-full mt-4">مرحله بعد</Button>
          </>
        )}
        
        {step === 2 && (
          <>
            <Input label="نام مزرعه" value={form.farm_name} onChange={(e) => setForm({ ...form, farm_name: e.target.value })} />
            <Input label="شماره موبایل (برای هشدارها)" placeholder="09123456789" value={form.phone_number} onChange={(e) => setForm({ ...form, phone_number: e.target.value })} />
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>قبلی</Button>
              <Button type="button" onClick={() => setStep(3)} className="flex-1">مرحله بعد</Button>
            </div>
          </>
        )}
        
        {step === 3 && (
          <>
            <Button type="button" variant="outline" onClick={getLocation} className="w-full mb-3"><i className="fas fa-crosshairs"></i> دریافت موقعیت خودکار</Button>
            <Input label="عرض جغرافیایی" value={form.latitude} onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) })} />
            <Input label="طول جغرافیایی" value={form.longitude} onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) })} />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <div className="flex gap-2 mt-4">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>قبلی</Button>
              <Button type="submit" loading={loading} className="flex-1">ثبت‌نام نهایی</Button>
            </div>
          </>
        )}
      </form>
      
      <hr className="my-6 border-[var(--border-color)]" />
      <div className="text-center">
        <p className="text-sm text-[var(--text-secondary)]">قبلاً ثبت‌نام کرده‌اید؟ <a href="/login" className="text-[#9CB080]">وارد شوید</a></p>
      </div>
    </Card>
  );
}
