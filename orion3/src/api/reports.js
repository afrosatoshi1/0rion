// 0rion Community Reports — Real crowd-sourced incidents
// Users report what they see → stored in Supabase → visible to everyone nearby
// This is how 0rion knows about kidnappings, accidents, fires before the news does

import { supabase } from '../lib/supabase'

export const INCIDENT_TYPES = [
  { id: 'kidnapping',    label: 'Kidnapping',         emoji: '🚨', severity: 'CRITICAL', color: '#EF4444' },
  { id: 'robbery',       label: 'Armed Robbery',      emoji: '🔫', severity: 'CRITICAL', color: '#EF4444' },
  { id: 'accident',      label: 'Road Accident',      emoji: '🚗', severity: 'HIGH',     color: '#F59E0B' },
  { id: 'fire',          label: 'Fire Outbreak',      emoji: '🔥', severity: 'HIGH',     color: '#F59E0B' },
  { id: 'flood',         label: 'Flooding',           emoji: '🌊', severity: 'HIGH',     color: '#60A5FA' },
  { id: 'protest',       label: 'Protest/Unrest',     emoji: '✊', severity: 'MEDIUM',   color: '#A78BFA' },
  { id: 'power',         label: 'Power Outage',       emoji: '⚡', severity: 'MEDIUM',   color: '#FCD34D' },
  { id: 'road_block',    label: 'Road Blockage',      emoji: '🚧', severity: 'MEDIUM',   color: '#F97316' },
  { id: 'gunshots',      label: 'Gunshots Heard',     emoji: '💥', severity: 'CRITICAL', color: '#EF4444' },
  { id: 'gas_leak',      label: 'Gas Leak',           emoji: '☣️', severity: 'HIGH',     color: '#F59E0B' },
  { id: 'market_fire',   label: 'Market Fire',        emoji: '🔥', severity: 'HIGH',     color: '#F59E0B' },
  { id: 'building_collapse', label: 'Building Collapse', emoji: '🏚️', severity: 'CRITICAL', color: '#EF4444' },
  { id: 'cult_clash',    label: 'Cult Clash',         emoji: '⚔️', severity: 'CRITICAL', color: '#EF4444' },
  { id: 'police_action', label: 'Police Action',      emoji: '👮', severity: 'MEDIUM',   color: '#60A5FA' },
  { id: 'medical',       label: 'Medical Emergency',  emoji: '🏥', severity: 'HIGH',     color: '#34D399' },
  { id: 'other',         label: 'Other Incident',     emoji: '📌', severity: 'MEDIUM',   color: '#94A3B8' },
]

export function getIncidentType(id) {
  return INCIDENT_TYPES.find(t => t.id === id) || INCIDENT_TYPES[INCIDENT_TYPES.length - 1]
}

// ─── Fetch reports near a location ────────────────────────
export async function fetchNearbyReports({ lat, lon, radiusKm = 50, hours = 48 }) {
  if (!supabase) return []
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error

    // Filter by distance client-side (simple haversine)
    return (data || []).filter(r => {
      if (!r.lat || !r.lon) return true // no coords — show anyway
      const dist = haversineKm(lat, lon, r.lat, r.lon)
      return dist <= radiusKm
    })
  } catch { return [] }
}

// ─── Fetch ALL reports for the map ────────────────────────
export async function fetchAllReports({ hours = 72, limit = 500 } = {}) {
  if (!supabase) return []
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data || []
  } catch { return [] }
}

// ─── Fetch reports for a specific state ───────────────────
export async function fetchStateReports(state, hours = 72) {
  if (!supabase) return []
  try {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .ilike('state', `%${state}%`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return data || []
  } catch { return [] }
}

// ─── Submit a new report ──────────────────────────────────
export async function submitReport({ type, title, description, lat, lon, state, lga, anonymous, userId }) {
  if (!supabase) return { success: false, error: 'Supabase not configured' }
  try {
    const { data, error } = await supabase
      .from('community_reports')
      .insert({
        type,
        title: title || INCIDENT_TYPES.find(t => t.id === type)?.label || 'Incident',
        description: description || '',
        lat: lat || null,
        lon: lon || null,
        state: state || '',
        lga: lga || '',
        user_id: anonymous ? null : userId,
        verified_count: 0,
        created_at: new Date().toISOString(),
      })
      .select()
      .single()
    if (error) throw error
    return { success: true, report: data }
  } catch (err) {
    return { success: false, error: err.message }
  }
}

// ─── Verify/confirm a report (crowd validation) ───────────
export async function verifyReport(reportId, userId) {
  if (!supabase) return false
  try {
    // Check if user already verified
    const { data: existing } = await supabase
      .from('report_verifications')
      .select('id')
      .eq('report_id', reportId)
      .eq('user_id', userId)
      .single()
    if (existing) return false // already verified

    // Insert verification
    await supabase.from('report_verifications').insert({ report_id: reportId, user_id: userId })

    // Increment count
    const { data: report } = await supabase
      .from('community_reports')
      .select('verified_count')
      .eq('id', reportId)
      .single()

    await supabase
      .from('community_reports')
      .update({ verified_count: (report?.verified_count || 0) + 1 })
      .eq('id', reportId)

    return true
  } catch { return false }
}

// ─── Haversine distance ────────────────────────────────────
export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// ─── Real-time subscription to new reports ────────────────
export function subscribeToReports(callback) {
  if (!supabase) return () => {}
  const channel = supabase
    .channel('community_reports_changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'community_reports',
    }, payload => callback(payload.new))
    .subscribe()
  return () => supabase.removeChannel(channel)
}
