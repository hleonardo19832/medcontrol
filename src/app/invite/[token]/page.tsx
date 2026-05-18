'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

export default function AcceptInvitePage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [link, setLink] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace(`/auth/login`); return }

      const { data } = await supabase
        .from('caregiver_links')
        .select('*, patient:profiles!caregiver_links_patient_id_fkey(full_name, email)')
        .eq('invite_token', params.token)
        .single()

      setLink(data)
      setLoading(false)
    }
    load()
  }, [params.token])

  async function handleAccept() {
    setProcessing(true)
    await supabase.from('caregiver_links')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('invite_token', params.token)
    toast.success('Convite aceito!')
    router.push('/dashboard/caregiver')
  }

  async function handleReject() {
    setProcessing(true)
    await supabase.from('caregiver_links')
      .update({ status: 'rejected' })
      .eq('invite_token', params.token)
    toast('Convite recusado')
    router.push('/dashboard')
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center"><div className="text-4xl mb-3">👥</div><p className="text-slate-500 text-sm">Carregando...</p></div>
    </div>
  )

  if (!link) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-indigo-50 px-4">
      <div className="card p-8 max-w-sm w-full text-center">
        <div className="text-4xl mb-3">❌</div>
        <h1 className="text-xl font-bold text-slate-900">Convite inválido</h1>
        <p className="text-slate-500 text-sm mt-2">Este link não existe ou expirou.</p>
      </div>
    </div>
  )

  const patient = link.patient

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-indigo-50 px-4">
      <div className="card p-8 max-w-sm w-full text-center animate-slide-in">
        <div className="text-5xl mb-4">👥</div>
        <h1 className="text-xl font-bold text-slate-900">Convite de cuidador</h1>
        <p className="text-slate-500 text-sm mt-3">
          <strong className="text-slate-700">{patient?.full_name}</strong> ({patient?.email}) quer que você seja o cuidador dele no MedControl.
        </p>
        <p className="text-slate-400 text-xs mt-2">
          Como cuidador, você verá se as doses foram confirmadas e receberá alertas caso alguma seja perdida.
        </p>
        <div className="flex gap-3 mt-6">
          <button onClick={handleReject} disabled={processing} className="btn-secondary flex-1">Recusar</button>
          <button onClick={handleAccept} disabled={processing} className="btn-primary flex-1">✓ Aceitar</button>
        </div>
      </div>
    </div>
  )
}
