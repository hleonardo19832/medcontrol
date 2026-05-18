import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, addDays } from 'date-fns'
import { sendDoseReminder, sendMissedDoseAlert, sendStockAlert } from '@/lib/onesignal'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const today    = format(new Date(), 'yyyy-MM-dd')
  const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd')
  const yesterday = format(addDays(new Date(), -1), 'yyyy-MM-dd')

  // 1. Marcar doses pendentes de ontem como perdidas
  await supabase
    .from('doses')
    .update({ status: 'missed' })
    .eq('scheduled_date', yesterday)
    .eq('status', 'pending')

  // 2. Gerar doses para hoje e amanhã
  const { data: medications } = await supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .lte('start_date', tomorrow)

  const dosesToInsert: any[] = []
  for (const med of medications ?? []) {
    for (const date of [today, tomorrow]) {
      if (med.end_date && date > med.end_date) continue
      if (med.frequency === 'specific_days') {
        const dayOfWeek = new Date(date + 'T12:00:00').getDay()
        if (!med.specific_days?.includes(dayOfWeek)) continue
      }
      for (const time of med.schedule_times) {
        dosesToInsert.push({
          medication_id: med.id,
          user_id: med.user_id,
          scheduled_date: date,
          scheduled_time: time,
          status: 'pending',
        })
      }
    }
  }

  if (dosesToInsert.length > 0) {
    await supabase.from('doses').upsert(dosesToInsert, {
      onConflict: 'medication_id,scheduled_date,scheduled_time',
      ignoreDuplicates: true,
    })
  }

  // 3. Enviar lembretes das doses de hoje via OneSignal
  const now = new Date()
  const currentHour = now.getHours()
  const currentMin = now.getMinutes()
  const windowStart = `${String(currentHour).padStart(2,'0')}:${String(currentMin).padStart(2,'0')}`
  const windowEnd = `${String(currentHour + 1).padStart(2,'0')}:${String(currentMin).padStart(2,'0')}`

  const { data: todayDoses } = await supabase
    .from('doses')
    .select('*, medication:medications(name, dose_amount, dose_unit)')
    .eq('scheduled_date', today)
    .eq('status', 'pending')
    .gte('scheduled_time', windowStart)
    .lte('scheduled_time', windowEnd)

  for (const dose of todayDoses ?? []) {
    await sendDoseReminder({
      userId: dose.user_id,
      medicationName: dose.medication?.name,
      doseAmount: dose.medication?.dose_amount,
      doseUnit: dose.medication?.dose_unit,
      scheduledTime: dose.scheduled_time,
      doseId: dose.id,
    })
  }

  // 4. Alertas de doses perdidas para cuidadores (30+ min atrasadas)
  const thirtyMinAgo = new Date(now.getTime() - 30 * 60000)
  const lateTime = `${String(thirtyMinAgo.getHours()).padStart(2,'0')}:${String(thirtyMinAgo.getMinutes()).padStart(2,'0')}`

  const { data: lateDoses } = await supabase
    .from('doses')
    .select('user_id, scheduled_time, medication:medications(name), patient:profiles!doses_user_id_fkey(full_name)')
    .eq('scheduled_date', today)
    .eq('status', 'pending')
    .lte('scheduled_time', lateTime)

  for (const dose of lateDoses ?? []) {
    const { data: caregiverLinks } = await supabase
      .from('caregiver_links')
      .select('caregiver_id')
      .eq('patient_id', dose.user_id)
      .eq('status', 'accepted')

    for (const link of caregiverLinks ?? []) {
      await sendMissedDoseAlert({
        caregiverId: link.caregiver_id,
        patientName: (dose.patient as any)?.full_name ?? 'Paciente',
        medicationName: (dose.medication as any)?.name ?? 'Medicamento',
        scheduledTime: dose.scheduled_time,
      })
    }
  }

  // 5. Alertas de estoque acabando
  const { data: lowStockMeds } = await supabase
    .from('medications')
    .select('*')
    .eq('is_active', true)
    .not('stock_count', 'is', null)

  for (const med of lowStockMeds ?? []) {
    if (!med.stock_count) continue
    const dailyDoses = med.times_per_day * med.dose_amount
    const daysLeft = Math.floor(med.stock_count / dailyDoses)
    if (daysLeft <= med.stock_alert_days) {
      await sendStockAlert({
        userId: med.user_id,
        medicationName: med.name,
        daysLeft,
      })
    }
  }

  return NextResponse.json({ ok: true, doses: dosesToInsert.length, date: today })
}
