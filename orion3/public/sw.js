// 0rion Service Worker — handles background push notifications

self.addEventListener('install', e => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Background push handler
self.addEventListener('push', e => {
  let data = { title: '0rion Alert', body: 'New intelligence signal detected.', url: '/', severity: 'HIGH' }
  try { data = { ...data, ...e.data.json() } } catch {}

  const icon = '/icon-192.png'
  const badge = '/badge-72.png'
  const tag = data.severity === 'CRITICAL' ? 'critical-alert' : 'orion-alert'

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon,
      badge,
      tag,
      renotify: true,
      requireInteraction: data.severity === 'CRITICAL',
      vibrate: data.severity === 'CRITICAL' ? [200, 100, 200, 100, 400] : [200],
      data: { url: data.url || '/' },
      actions: [
        { action: 'view',    title: 'View Alert' },
        { action: 'dismiss', title: 'Dismiss' },
      ]
    })
  )
})

// Notification click handler
self.addEventListener('notificationclick', e => {
  e.notification.close()
  if (e.action === 'dismiss') return
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const url = e.notification.data?.url || '/'
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NAVIGATE', url })
          return client.focus()
        }
      }
      return self.clients.openWindow(url)
    })
  )
})

// Background sync — retry failed push registrations
self.addEventListener('sync', e => {
  if (e.tag === 'sync-subscription') {
    e.waitUntil(Promise.resolve())
  }
})
