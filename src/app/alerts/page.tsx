'use client';

import { useEffect, useState } from 'react';
import { useAuth, Button, Card, Modal, Input, Select, AlertRuleCard } from '@/components';
import { createClient } from '@/lib/supabase';
import type { AlertRule } from '@/types';

export default function AlertsPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    sensor_type: 'soil_moisture',
    operator: 'below',
    threshold: 25,
    sms_template: 'هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.',
  });

  const fetchRules = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    setRules(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRules();
  }, [user]);

  const handleToggle = async (id: number) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    await supabase
      .from('alert_rules')
      .update({ enabled: !rule.enabled })
      .eq('id', id);
    fetchRules();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این قانون هشدار اطمینان دارید؟')) return;
    await supabase.from('alert_rules').delete().eq('id', id);
    fetchRules();
  };

  const handleAdd = async () => {
    if (!form.name.trim()) return;
    await supabase.from('alert_rules').insert({
      user_id: user?.id,
      name: form.name,
      sensor_type: form.sensor_type,
      operator: form.operator,
      threshold: form.threshold,
      sms_template: form.sms_template,
      enabled: true,
    });
    setModalOpen(false);
    setForm({
      name: '',
      sensor_type: 'soil_moisture',
      operator: 'below',
      threshold: 25,
      sms_template: 'هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.',
    });
    fetchRules();
  };

  const updateTemplateBySensor = (sensor: string) => {
    if (sensor === 'soil_moisture') {
      setForm({ ...form, sensor_type: sensor, sms_template: 'هشدار! رطوبت خاک به {value}% رسیده است. لطفاً آبیاری کنید.' });
    } else if (sensor === 'temperature') {
      setForm({ ...form, sensor_type: sensor, sms_template: 'هشدار! دمای گلخانه به {value}°C رسیده است.' });
    } else {
      setForm({ ...form, sensor_type: sensor, sms_template: 'هشدار! سطح آب تانک به {value}% رسیده است. {remaining_liters} لیتر باقی مانده.' });
    }
  };

  if (loading) return <div className="flex justify-center py-12"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold"><i className="fas fa-bell ml-2 text-[#9CB080]"></i>قوانین هشدار SMS</h3>
        <Button onClick={() => setModalOpen(true)}><i className="fas fa-plus ml-1"></i> افزودن قانون هشدار</Button>
      </div>
      
      <p className="text-[var(--text-secondary)] text-sm">
        <i className="fas fa-info-circle ml-1"></i>
        قوانین هشدار شرایطی را تعیین می‌کنند که در صورت بروز، پیامک به شماره موبایل ثبت‌شده در تنظیمات ارسال شود.
        از <code className="px-1 bg-[var(--bg-secondary)] rounded">{'{value}'}</code> برای نمایش مقدار و <code className="px-1 bg-[var(--bg-secondary)] rounded">{'{remaining_liters}'}</code> برای لیتر باقیمانده استفاده کنید.
      </p>
      
      {rules.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-[var(--card-bg)]">
          <i className="fas fa-bell text-5xl text-[var(--text-secondary)] mb-3"></i>
          <p>هیچ قانون هشداری تعریف نشده است</p>
          <Button variant="outline" onClick={() => setModalOpen(true)} className="mt-3">افزودن قانون اول</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => (
            <AlertRuleCard key={rule.id} rule={rule} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
      
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="افزودن قانون هشدار جدید">
        <Input label="نام قانون" placeholder="مثال: هشدار کمبود رطوبت" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        
        <Select 
          label="نوع سنسور" 
          options={[
            { value: 'soil_moisture', label: 'رطوبت خاک' },
            { value: 'temperature', label: 'دما' },
            { value: 'tank_level', label: 'سطح تانک' },
          ]} 
          value={form.sensor_type} 
          onChange={(e) => updateTemplateBySensor(e.target.value)} 
        />
        
        <Select 
          label="عملگر" 
          options={[
            { value: 'below', label: 'کمتر از (<)' },
            { value: 'above', label: 'بیشتر از (>)' },
            { value: 'equal', label: 'مساوی (=)' },
            { value: 'not_equal', label: 'نامساوی (≠)' },
          ]} 
          value={form.operator} 
          onChange={(e) => setForm({ ...form, operator: e.target.value })} 
        />
        
        <Input 
          label="مقدار آستانه" 
          type="number" 
          step="0.5"
          value={form.threshold} 
          onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) })} 
        />
        
        <Input 
          label="متن پیامک" 
          placeholder="متن پیامک..." 
          value={form.sms_template} 
          onChange={(e) => setForm({ ...form, sms_template: e.target.value })} 
        />
        
        <div className="text-xs text-[var(--text-secondary)] mt-2">
          <i className="fas fa-lightbulb ml-1"></i>
          نکته: از {'{value}'} برای مقدار فعلی و {'{remaining_liters}'} برای لیتر باقیمانده استفاده کنید.
        </div>
        
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>انصراف</Button>
          <Button onClick={handleAdd}>ذخیره قانون</Button>
        </div>
      </Modal>
    </div>
  );
}
