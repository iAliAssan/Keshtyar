
'use client';

import { useEffect, useState } from 'react';
import { useAuth, Button, Card, Modal, Input, Select, RelayCard } from '@/components';
import { createClient } from '@/lib/supabase';
import { ALLOWED_GPIO } from '@/config';
import type { Relay } from '@/types';

export default function RelaysPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const [relays, setRelays] = useState<Relay[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [newRelay, setNewRelay] = useState({ name: '', gpio: 12 });

  const fetchRelays = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('relays')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });
    setRelays(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRelays();
  }, [user]);

  const handleToggle = async (id: number) => {
    const relay = relays.find(r => r.id === id);
    if (!relay) return;
    const newState = !relay.state;
    
    await supabase
      .from('relays')
      .update({ state: newState })
      .eq('id', id);
    
    // Create command for ESP32
    await supabase.from('command_logs').insert({
      user_id: user?.id,
      command_id: crypto.randomUUID(),
      command_type: 'relay_set',
      payload: JSON.stringify({ gpio: relay.gpio, state: newState }),
      acknowledged: false,
    });
    
    fetchRelays();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('آیا از حذف این رله اطمینان دارید؟')) return;
    await supabase.from('relays').delete().eq('id', id);
    fetchRelays();
  };

  const handleAdd = async () => {
    if (!newRelay.name.trim()) return;
    await supabase.from('relays').insert({
      user_id: user?.id,
      name: newRelay.name,
      gpio: newRelay.gpio,
      state: false,
    });
    setModalOpen(false);
    setNewRelay({ name: '', gpio: 12 });
    fetchRelays();
  };

  if (loading) return <div className="flex justify-center py-12"><i className="fas fa-spinner fa-spin text-2xl"></i></div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-3">
        <h3 className="text-xl font-bold"><i className="fas fa-plug ml-2 text-[#9CB080]"></i>مدیریت رله‌ها</h3>
        <Button onClick={() => setModalOpen(true)}><i className="fas fa-plus ml-1"></i> افزودن رله</Button>
      </div>
      
      <p className="text-[var(--text-secondary)] text-sm">GPIO های مجاز: {ALLOWED_GPIO.join(', ')}</p>
      
      {relays.length === 0 ? (
        <div className="text-center py-12 rounded-xl bg-[var(--card-bg)]">
          <i className="fas fa-plug text-5xl text-[var(--text-secondary)] mb-3"></i>
          <p>هیچ رله‌ای تعریف نشده است</p>
          <Button variant="outline" onClick={() => setModalOpen(true)} className="mt-3">افزودن رله اول</Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {relays.map(relay => (
            <RelayCard key={relay.id} relay={relay} onToggle={handleToggle} onDelete={handleDelete} />
          ))}
        </div>
      )}
      
      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="افزودن رله جدید">
        <Input label="نام رله" placeholder="مثال: پمپ آبیاری" value={newRelay.name} onChange={(e) => setNewRelay({ ...newRelay, name: e.target.value })} />
        <Select label="شماره GPIO" options={ALLOWED_GPIO.map(g => ({ value: String(g), label: `GPIO ${g}` }))} value={String(newRelay.gpio)} onChange={(e) => setNewRelay({ ...newRelay, gpio: parseInt(e.target.value) })} />
        <div className="flex gap-2 mt-4">
          <Button variant="outline" onClick={() => setModalOpen(false)}>انصراف</Button>
          <Button onClick={handleAdd}>ذخیره</Button>
        </div>
      </Modal>
    </div>
  );
}
