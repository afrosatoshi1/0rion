// 0rion Push Notification Manager
// Uses VAPID + Service Worker + Supabase to store subscriptions

import { supabase } from './supabase'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || ''

// Convert VAPID public key from base64url to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Register service worker
export async function registerSW() {
  if (!('serviceWorker' in navigator)) return null
  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready
    return reg
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

// Request permission and subscribe to push
export async function subscribeToPush(userId) {
  if (!('Notification' in window)) return { ok: false, reason: 'not_supported' }

  // Request permission
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  // Need VAPID key for real push
  if (!VAPID_PUBLIC_KEY) {
    // Fallback: local notifications only (no background push)
    return { ok: true, reason: 'local_only' }
  }

  try {
    const reg = await registerSW()
    if (!reg) return { ok: false, reason: 'sw_failed' }

    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    // Save subscription to Supabase
    if (supabase && userId && userId !== 'guest') {
      await supabase.from('push_subscriptions').upsert({
        user_id: userId,
        subscription: subscription.toJSON(),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
    }

    return { ok: true, reason: 'push_enabled', subscription }
  } catch (e) {
    console.warn('Push subscription failed:', e)
    return { ok: false, reason: 'error', error: e.message }
  }
}

// Unsubscribe
export async function unsubscribeFromPush(userId) {
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) await sub.unsubscribe()
    if (supabase && userId && userId !== 'guest') {
      await supabase.from('push_subscriptions').delete().eq('user_id', userId)
    }
    return true
  } catch { return false }
}

// Send a local notification right now (works without VAPID, requires permission)
export function notify(title, body, severity = 'HIGH') {
  if (Notification.permission !== 'granted') return
  const n = new Notification(title, {
    body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    requireInteraction: severity === 'CRITICAL',
    vibrate: severity === 'CRITICAL' ? [200, 100, 200, 100, 400] : [200],
    tag: severity === 'CRITICAL' ? 'critical' : 'orion',
    renotify: true,
  })
  n.onclick = () => { window.focus(); n.close() }
}

// Check current push status
export async function getPushStatus() {
  if (!('Notification' in window)) return 'not_supported'
  if (Notification.permission === 'denied') return 'denied'
  if (Notification.permission === 'default') return 'not_asked'
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    return sub ? 'subscribed' : 'granted_not_subscribed'
  } catch { return 'granted_not_subscribed' }
}
