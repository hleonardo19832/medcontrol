'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function OneSignalInit() {
  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
    if (!appId || typeof window === 'undefined') return

    // Load OneSignal SDK
    const script = document.createElement('script')
    script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
    script.defer = true
    document.head.appendChild(script)

    window.OneSignalDeferred = window.OneSignalDeferred || []
    window.OneSignalDeferred.push(async function (OneSignal: any) {
      await OneSignal.init({
        appId,
        safari_web_id: '',
        notifyButton: { enable: false },
        allowLocalhostAsSecureOrigin: true,
      })

      // Link OneSignal user to Supabase user
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await OneSignal.login(user.id)
      }

      // Listen for subscription changes
      OneSignal.User.PushSubscription.addEventListener('change', async (event: any) => {
        if (event.current.token && user) {
          await supabase.from('profiles').update({
            push_subscription: { onesignal: true, token: event.current.token }
          }).eq('id', user.id)
        }
      })
    })

    return () => {
      document.head.removeChild(script)
    }
  }, [])

  return null
}

// Extend window type
declare global {
  interface Window {
    OneSignalDeferred: any[]
  }
}
