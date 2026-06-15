'use client';

import { useEffect, useState } from 'react';
import { useAuth, Button, Card, Modal, Input, Select, RuleCard } from '@/components';
import { createClient } from '@/lib/supabase';
import type { AutomationRule, Relay } from '@/types';

export default function RulesPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [conditionType, setConditionType] = useState<'single' | 'and'>('single');
  const [form, setForm] = useState({
    name: '',
    relay_id: 0,
    sensor_type: 'soil_moisture',
    operator: 'below',
    threshold: 25,
    action_state: true,
    // and condition fields
    second_sensor_type: 'temperature',
    second_operator: 'below',
    second_threshold: 35,
  });

  const fetchData = async () => {
    if (!user) return;
    const { data: rulesData } = await supabase.from('automation_rules').select('*').eq('user_id', user.id);
    const { data: relaysData } = await supabase.from('relays').select('*').eq('user_id', user.id);
    setRules(rulesData || []);
    setRelays(relaysData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleToggle = async (id: number) => {
    const rule = rules.find(r => r.id === id);
    if (!rule) return;
    await supabase.from('automation_rules').update({ active: !rule.active }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این قانون اطمینان دارید؟')) return;
    await supabase.from('automation_rules').delete().eq('id', id);
    fetchData();
  };

  const handleAdd = async () => {
    if (!form.name || !form.relay_id) return;
    
    let ruleData: any = {
      user_id: user?.id,
      relay_id: form.relay_id,
      name: form.name,
      action_state: form.action_state,
      active: true,
      condition_type: conditionType,
    };
    
    if (conditionType === 'single') {
      ruleData.rule_type = `${form.sensor_type}_${form.operator}`;
      ruleData.threshold = form.threshold;
    } else {
      ruleData.rule_type = form.sensor_type === 'soil_moisture' ? 'moisture_below' : 'moisture_above';
      ruleData.threshold = form.threshold;
      ruleData.second_sensor_type = form.second_sensor_type;
      ruleData.second_operator = form.second_operator;
      ruleData.second_threshold = form.second_threshold;
    }
    
    await supabase.from('automation_rules').insert(ruleData);
    setModalOpen(false);
    setForm({ name: '', relay_id: 0, sensor_type: 'soil_moisture', operator: 'below', threshold: 25, action_state: true, second_sensor_type: 'temperature', second_operator: 'below', second_threshold: 35 });
    fetchData();
  };

  if (loading) return <div className="flex justify-center py-12"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold"><i className="fas fa-cogs ml-2 text-[#9CB080]"></i>قوانین اتوماسیون</h3>
        <Button onClick={() => setModalOpen(true)} disabled={relays.length === 0}><i className="fas fa-plus ml-1"></i> افزودن قانون</Button>
      </div>
      
      {relays.length === 0 && <div className="p-3 rounded-xl bg-yellow-500/10 text-yellow-500 text-sm">لطفاً ابتدا در صفحه رله‌ها یک رله ایجاد کنید.</div>}
      
      {rules.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-[var(--card-bg)]">
          <i className="fas fa-cogs text-5xl text-[var(--text-secondary)] mb-3"></i>
          <p>هیچ قانونی تعریف نشده است</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rules.map(rule => {
            const relay = relays.find(r => r.id === rule.relay_id);
            return <RuleCard key={rule.id} rule={rule} relayName={relay?.name || 'نامشخص'} onToggle={handleToggle} onDelete={handleDelete} />;
          })}
        </div>
      )}
      
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="افزودن قانون جدید">
        <Input label="نام قانون" placeholder="مثال: روشن شدن پمپ در رطوبت کم" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Select label="انتخاب رله" options={relays.map(r => ({ value: String(r.id), label: `${r.name} (GPIO ${r.gpio})` }))} value={String(form.relay_id)} onChange={(e) => setForm({ ...form, relay_id: parseInt(e.target.value) })} />
        
        <div className="flex gap-2 mb-4">
          <button onClick={() => setConditionType('single')} className={`flex-1 py-2 rounded-xl transition-all ${conditionType === 'single' ? 'bg-[#9CB080] text-white' : 'bg-[var(--bg-secondary)]'}`}>ساده</button>
          <button onClick={() => setConditionType('and')} className={`flex-1 py-2 rounded-xl transition-all ${conditionType === 'and' ? 'bg-[#9CB080] text-white' : 'bg-[var(--bg-secondary)]'}`}>ترکیبی (AND)</button>
        </div>
        
        {conditionType === 'single' ? (
          <>
            <Select label="نوع سنسور" options={[
              { value: 'soil_moisture', label: 'رطوبت خاک' },
              { value: 'temperature', label: 'دما' },
              { value: 'tank_level', label: 'سطح تانک' },
            ]} value={form.sensor_type} onChange={(e) => setForm({ ...form, sensor_type: e.target.value })} />
            <Select label="عملگر" options={[
              { value: 'below', label: 'کمتر از (<)' },
              { value: 'above', label: 'بیشتر از (>)' },
              { value: 'equal', label: 'مساوی (=)' },
              { value: 'not_equal', label: 'نامساوی (≠)' },
            ]} value={form.operator} onChange={(e) => setForm({ ...form, operator: e.target.value })} />
            <Input label="مقدار آستانه" type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) })} />
          </>
        ) : (
          <>
            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] text-sm mb-3">شرط اول: رطوبت خاک</div>
            <Select label="نوع شرط اول" options={[{ value: 'moisture_below', label: 'کمتر از' }, { value: 'moisture_above', label: 'بیشتر از' }]} value="moisture_below" onChange={() => {}} />
            <Input label="مقدار آستانه رطوبت" type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: parseFloat(e.target.value) })} />
            <div className="p-3 rounded-xl bg-[var(--bg-secondary)] text-sm mb-3 mt-3">شرط دوم (AND)</div>
            <Select label="نوع سنسور دوم" options={[{ value: 'temperature', label: 'دما' }, { value: 'tank_level', label: 'سطح تانک' }]} value={form.second_sensor_type} onChange={(e) => setForm({ ...form, second_sensor_type: e.target.value })} />
            <Select label="عملگر دوم" options={[{ value: 'below', label: 'کمتر از' }, { value: 'above', label: 'بیشتر از' }]} value={form.second_operator} onChange={(e) => setForm({ ...form, second_operator: e.target.value })} />
            <Input label="مقدار آستانه دوم" type="number" value={form.second_threshold} onChange={(e) => setForm({ ...form, second_threshold: parseFloat(e.target.value) })} />
          </>
        )}
        
        <Select label="عملیات" options={[{ value: 'true', label: 'روشن کردن' }, { value: 'false', label: 'خاموش کردن' }]} value={String(form.action_state)} onChange={(e) => setForm({ ...form, action_state: e.target.value === 'true' })} />
        
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>انصراف</Button>
          <Button onClick={handleAdd}>ذخیره قانون</Button>
        </div>
      </Modal>
    </div>
  );
}
