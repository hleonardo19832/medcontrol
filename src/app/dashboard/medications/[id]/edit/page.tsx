'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import EditForm from './EditForm'

export default function EditMedicationPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const [medication, setMedication] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/auth/login'); return }

      const { data } = await supabase
        .from('medications')
        .select('*')
        .eq('id', params.id)
        .eq('user_id', user.id)
        .single()

      if (!data) { router.replace('/dashboard/medications'); return }
      setMedication(data)
      setLoading(false)
    }
    load()
  }, [params.id])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="text-4xl mb-3">💊</div>
        <p className="text-slate-500 text-sm">Carregando...</p>
      </div>
    </div>
  )

  return <EditForm medication={medication} />
}
