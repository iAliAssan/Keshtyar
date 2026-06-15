
import { createServerSupabaseClient } from '@/lib/supabase';
import { calculateSoilMoisturePercent, calculateTankLevel, evaluateRule, checkAlertRule, getCurrentTehran } from '@/lib/utils';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { device_code, temperature, humidity, soil_moisture_raw, tank_distance_mm } = body;

    if (!device_code) {
      return NextResponse.json({ status: 'error', message: 'device_code required' }, { status: 400 });
    }

    const supabase = await createServerSupabaseClient();

    // Get user
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('*')
      .eq('device_code', device_code)
      .single();

    if (userError || !user) {
      return NextResponse.json({ status: 'error', message: 'Invalid device code' }, { status: 401 });
    }

    // Calculate soil moisture percent
    const soil_moisture = calculateSoilMoisturePercent(soil_moisture_raw, user.soil_dry_raw, user.soil_wet_raw);

    // Calculate tank level
    const tank = calculateTankLevel(tank_distance_mm, user.tank_height_mm, user.tank_capacity_liters);

    // Insert sensor data
    const { data: sensor, error: insertError } = await supabase
      .from('sensor_data')
      .insert({
        user_id: user.id,
        temperature: temperature || null,
        humidity: humidity || null,
        soil_moisture_raw: soil_moisture_raw || null,
        soil_moisture: soil_moisture,
        tank_distance_mm: tank_distance_mm || null,
        tank_level_percent: tank.percent,
        tank_liters: tank.liters,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
    }

    // Get current relays state
    const { data: relays } = await supabase
      .from('relays')
      .select('*')
      .eq('user_id', user.id);

    const relayStates: Record<number, boolean> = {};
    relays?.forEach(r => { relayStates[r.gpio] = r.state; });

    // Evaluate automation rules
    const { data: rules } = await supabase
      .from('automation_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('active', true);

    const currentTime = getCurrentTehran();
    const commands = [];
    const nowStr = currentTime.toISOString();

    for (const rule of rules || []) {
      const shouldExecute = evaluateRule(rule, soil_moisture || 0, temperature || null, tank.percent, currentTime);
      if (shouldExecute) {
        // Update last_triggered
        await supabase
          .from('automation_rules')
          .update({ last_triggered: nowStr })
          .eq('id', rule.id);

        const relay = relays?.find(r => r.id === rule.relay_id);
        if (relay && relay.state !== rule.action_state) {
          await supabase
            .from('relays')
            .update({ state: rule.action_state })
            .eq('id', relay.id);

          commands.push({
            id: crypto.randomUUID(),
            type: 'relay_set',
            payload: { gpio: relay.gpio, state: rule.action_state }
          });
        }
      }
    }

    // Check alert rules
    const { data: alertRules } = await supabase
      .from('alert_rules')
      .select('*')
      .eq('user_id', user.id)
      .eq('enabled', true);

    const smsRequests = [];
    const sensorValues = {
      soil_moisture: soil_moisture || 0,
      temperature: temperature || 0,
      tank_level: tank.percent,
    };

    for (const rule of alertRules || []) {
      const value = sensorValues[rule.sensor_type as keyof typeof sensorValues];
      if (value !== undefined && checkAlertRule(rule, value)) {
        // Check cooldown
        if (rule.last_sent_at) {
          const lastSent = new Date(rule.last_sent_at);
          const cooldownKey = `alert_cooldown_${rule.sensor_type === 'soil_moisture' ? 'soil' : rule.sensor_type === 'temperature' ? 'temp' : 'tank'}`;
          const cooldownMinutes = user[cooldownKey as keyof typeof user] as number || 60;
          if ((Date.now() - lastSent.getTime()) / 60000 < cooldownMinutes) continue;
        }

        await supabase
          .from('alert_rules')
          .update({ last_sent_at: nowStr })
          .eq('id', rule.id);

        let message = rule.sms_template.replace('{value}', String(value));
        if (rule.sensor_type === 'tank_level') {
          message = message.replace('{remaining_liters}', String(Math.round(tank.liters)));
        }
        if (user.phone_number) {
          smsRequests.push({ phone_number: user.phone_number, text: message });
        }
      }
    }

    // Get pending commands
    const { data: pendingCommands } = await supabase
      .from('command_logs')
      .select('*')
      .eq('user_id', user.id)
      .eq('acknowledged', false);

    for (const cmd of pendingCommands || []) {
      commands.push({
        id: cmd.command_id,
        type: cmd.command_type,
        payload: JSON.parse(cmd.payload || '{}'),
      });
    }

    return NextResponse.json({
      status: 'ok',
      relay_states: relayStates,
      commands,
      sms_requests: smsRequests,
    });
  } catch (error) {
    console.error('Sensor API error:', error);
    return NextResponse.json({ status: 'error', message: String(error) }, { status: 500 });
  }
}
