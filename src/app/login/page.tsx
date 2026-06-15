'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Card } from '@/components';
import { createClient } from '@/lib/supabase';
import { SITE_CONFIG } from '@/config';

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ device_code: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const supabase = createClient();
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, device_code, password_hash')
      .eq('device_code', form.device_code.toUpperCase())
      .single();
    
    if (userError || !user) {
      setError('کد یکتا یا رمز عبور اشتباه است');
      setLoading(false);
      return;
    }
    
    // Simple hash compare (in production use bcrypt)
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(form.password));
    const hashHex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
    
    if (hashHex !== user.password_hash) {
      setError('کد یکتا یا رمز عبور اشتباه است');
      setLoading(false);
      return;
    }
    
    await supabase.auth.signInWithPassword({
      email: `${user.id}@keshtyar.local`,
      password: form.password,
    });
    
    router.push('/dashboard');
  };

  return (
    <Card className="p-8">
      <div className="text-center mb-6">
        <i className="fas fa-leaf text-5xl text-[#9CB080]"></i>
        <h2 className="text-2xl font-bold mt-3">ورود به کشتیار</h2>
        <p className="text-[var(--text-secondary)] text-sm mt-1">دستیار هوشمند کشاورزی</p>
      </div>
      
      <form onSubmit={handleSubmit}>
        <Input
          label="کد یکتا دستگاه"
          placeholder="مثال: A7B3F9G2"
          value={form.device_code}
          onChange={(e) => setForm({ ...form, device_code: e.target.value.toUpperCase() })}
          className="text-center font-mono tracking-wider"
          required
        />
        <Input
          label="رمز عبور"
          type="password"
          placeholder="********"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
        <Button type="submit" loading={loading} className="w-full">ورود</Button>
      </form>
      
      <div className="text-center mt-4">
        <button onClick={() => alert(SITE_CONFIG.supportText)} className="text-sm text-[var(--text-secondary)] hover:text-[#9CB080]">
          <i className="fas fa-question-circle"></i> رمز عبور را فراموش کرده‌اید؟
        </button>
      </div>
      
      <hr className="my-6 border-[var(--border-color)]" />
      
      <div className="text-center">
        <p className="text-[var(--text-secondary)] mb-3">حساب کاربری ندارید؟</p>
        <a href="/register" className="block">
          <Button variant="outline" className="w-full">ثبت‌نام</Button>
        </a>
      </div>
    </Card>
  );
}
