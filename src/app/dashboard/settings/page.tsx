'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const supabase = createClient()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notifEnabled, setNotifEnabled] = useState(true)
  const [form, setForm] = useState({ full_name: '', phone: '' })

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
      setForm({ full_name: data?.full_name ?? '', phone: data?.phone ?? '' })
      setNotifEnabled(data?.notifications_enabled ?? true)
      setLoading(false)
    }
    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const { error } = await supabase.from('profiles')
      .update({ full_name: form.full_name, phone: form.phone, notifications_enabled: notifEnabled })
      .eq('id', profile.id)
    if (error) toast.error('Erro ao salvar')
    else toast.success('Salvo!')
    setSaving(false)
  }

  async function handleEnablePush() {
    if (!window.OneSignalDeferred) {
      toast.error('OneSignal não carregado')
      return
    }
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.Notifications.requestPermission()
      toast.success('Notificações ativadas! ✅')
    })
  }

  async function handleDisablePush() {
    if (!window.OneSignalDeferred) return
    window.OneSignalDeferred.push(async (OneSignal: any) => {
      await OneSignal.User.PushSubscription.optOut()
      toast.success('Notificações desativadas')
    })
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading) return <div className="text-center py-10 text-slate-400">Carregando...</div>

  return (
    <div className="space-y-5 animate-slide-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Configurações</h1>
        <p className="text-slate-500 text-sm mt-0.5">{profile?.email}</p>
      </div>

      {/* Plano atual */}
      <div className="card p-4 flex items-center justify-between">
        <div>
          <p className="font-semibold text-slate-800">
            {profile?.plan === 'free' ? '🆓 Free' :
             profile?.plan === 'basic' ? '💙 Básico' :
             profile?.plan === 'pro' ? '⭐ Pro' : '👑 Premium'}
          </p>
          <p className="text-sm text-slate-500 mt-0.5">
            {profile?.plan === 'free' ? '1 medicamento · 30 dias' :
             profile?.plan === 'basic' ? '5 medicamentos · 1 cuidador' :
             profile?.plan === 'pro' ? '15 medicamentos · PDF · Estoque' :
             'Ilimitado · Todos os recursos'}
          </p>
        </div>
        {profile?.plan === 'free' && (
          <Link href="/dashboard/upgrade" className="btn-primary text-sm px-4 py-2">Upgrade</Link>
        )}
      </div>

      {/* Perfil */}
      <form onSubmit={handleSave} className="card p-5 space-y-4">
        <h2 className="font-semibold text-slate-800">Meu perfil</h2>
        <div>
          <label className="label">Nome completo</label>
          <input type="text" className="input" value={form.full_name}
            onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} />
        </div>
        <div>
          <label className="label">Telefone (opcional)</label>
          <input type="tel" className="input" placeholder="(44) 99999-9999"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="font-medium text-sm text-slate-700">Receber notificações</p>
            <p className="text-xs text-slate-400">Alertas de doses no app</p>
          </div>
          <button type="button"
            className={`w-12 h-6 rounded-full transition-colors relative ${notifEnabled ? 'bg-brand-500' : 'bg-slate-200'}`}
            onClick={() => setNotifEnabled(n => !n)}>
            <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${notifEnabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
          </button>
        </div>
        <button type="submit" disabled={saving} className="btn-primary w-full">
          {saving ? 'Salvando...' : 'Salvar alterações'}
        </button>
      </form>

      {/* Notificações push OneSignal */}
      <div className="card p-5 space-y-3">
        <h2 className="font-semibold text-slate-800">Notificações Push</h2>
        <p className="text-sm text-slate-500">Receba alertas de doses mesmo com o app fechado, via OneSignal.</p>
        <div className="flex gap-2">
          <button onClick={handleEnablePush} className="btn-primary flex-1 text-sm py-2.5">
            🔔 Ativar push
          </button>
          <button onClick={handleDisablePush} className="btn-secondary flex-1 text-sm py-2.5">
            🔕 Desativar
          </button>
        </div>
      </div>

      {/* Planos */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Planos disponíveis</h2>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { plan: 'free',    icon: '🆓', price: 'Grátis/30d', meds: '1 med' },
            { plan: 'basic',   icon: '💙', price: 'R$ 9,90/mês', meds: '5 meds' },
            { plan: 'pro',     icon: '⭐', price: 'R$ 19,90/mês', meds: '15 meds' },
            { plan: 'premium', icon: '👑', price: 'R$ 39,90/mês', meds: 'Ilimitado' },
          ].map(p => (
            <div key={p.plan} className={`p-3 rounded-xl border ${profile?.plan === p.plan ? 'border-brand-400 bg-brand-50' : 'border-slate-100'}`}>
              <div className="font-semibold">{p.icon} {p.plan.charAt(0).toUpperCase() + p.plan.slice(1)}</div>
              <div className="text-slate-500 mt-0.5">{p.price}</div>
              <div className="text-slate-400">{p.meds}</div>
            </div>
          ))}
        </div>
        <Link href="/dashboard/upgrade" className="btn-secondary w-full mt-3 text-sm">
          Ver todos os planos →
        </Link>
      </div>

      {/* Conta */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 mb-3">Conta</h2>
        <button onClick={handleSignOut} className="btn-danger w-full text-sm py-2.5">
          Sair da conta
        </button>
      </div>

      <p className="text-center text-xs text-slate-400 pb-4">
        MedControl v1.0 · Não substitui orientação médica
      </p>
    </div>
  )
}
