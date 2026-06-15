
import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { data } = await supabase
    .from('sensor_data')
    .select('timestamp')
    .eq('user_id', session.user.id)
    .order('timestamp', { ascending: false })
    .limit(1);
  return NextResponse.json({ lastUpdate: data?.[0]?.timestamp || null });
}
