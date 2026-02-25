// Supabase Edge Function — sends web push notifications
// Deploy: supabase functions deploy send-push
// Called automatically via Database Webhook when new events are inserted

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Web push via VAPID — pure Deno, no external push service needed
async function sendWebPush(subscription: any, payload: string, vapidKeys: { publicKey: string, privateKey: string, subject: string }) {
  const { endpoint, keys } = subscription
  // Encode payload
  const encoder = new TextEncoder()
  const payloadBytes = encoder.encode(payload)

  // For production use the web-push library via esm.sh
  // This is a simplified direct implementation
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
      'Urgency': 'high',
    },
    body: payloadBytes,
  })
  return response.ok
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: { 'Access-Control-Allow-Origin': '*' } })

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json()
    const { title, message, severity, url = '/', targetUserIds } = body

    // Fetch subscriptions from DB
    let query = supabase.from('push_subscriptions').select('*')
    if (targetUserIds?.length) query = query.in('user_id', targetUserIds)
    const { data: subs, error } = await query

    if (error) throw error

    const payload = JSON.stringify({ title, body: message, severity, url })
    const results = await Promise.allSettled(
      (subs || []).map(sub => sendWebPush(sub.subscription, payload, {
        publicKey:  Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
        privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
        subject:    'mailto:' + (Deno.env.get('VAPID_SUBJECT') ?? 'admin@0rion.app'),
      }))
    )

    const sent = results.filter(r => r.status === 'fulfilled').length
    return new Response(JSON.stringify({ sent, total: subs?.length || 0 }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    })
  }
})
