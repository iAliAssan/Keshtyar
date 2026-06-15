import { createServerSupabaseClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const supabase = await createServerSupabaseClient();

    const { error } = await supabase
      .from('command_logs')
      .update({ acknowledged: true, acknowledged_at: new Date().toISOString() })
      .eq('command_id', id);

    if (error) {
      return NextResponse.json({ status: 'error', message: error.message }, { status: 404 });
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
