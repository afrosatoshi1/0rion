// 0rion Nigeria — Live Economy Data
// All real APIs, no mock data. Falls back gracefully if API fails.

import { supabase } from '../lib/supabase'

// ─── Naira exchange rate (frankfurter.app — free, no key) ─
export async function fetchNairaRate() {
  try {
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=NGN',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('rate fetch failed')
    const data = await res.json()
    const official = Math.round(data.rates.NGN)
    // Parallel market typically 15-25% above official
    // We show official rate and label it clearly
    return {
      official: official,
      parallel: null, // No free parallel market API exists — we'll crowdsource this
      date: data.date,
      source: 'ECB/Frankfurter',
      live: true,
    }
  } catch {
    return { official: null, parallel: null, live: false }
  }
}

// ─── Bitcoin & crypto prices (CoinGecko — free, no key) ───
export async function fetchCryptoPrices() {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,tether&vs_currencies=usd,ngn',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('crypto fetch failed')
    const data = await res.json()
    return {
      btc_usd: data.bitcoin?.usd,
      btc_ngn: data.bitcoin?.ngn,
      eth_usd: data.ethereum?.usd,
      eth_ngn: data.ethereum?.ngn,
      usdt_ngn: data.tether?.ngn,
      live: true,
    }
  } catch {
    return { live: false }
  }
}

// ─── Global commodity prices (metals/oil — free) ──────────
export async function fetchCommodities() {
  try {
    // Brent crude oil via frankfurter proxy isn't available
    // Use open.er-api.com for commodity-linked currencies as proxy
    // For Nigerian context: oil price matters most
    const res = await fetch(
      'https://api.frankfurter.app/latest?from=USD&to=NGN,GBP,EUR,XAU',
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error('commodity fetch failed')
    const data = await res.json()
    return {
      usd_ngn: Math.round(data.rates.NGN),
      usd_gbp: data.rates.GBP,
      usd_eur: data.rates.EUR,
      gold_oz_usd: data.rates.XAU ? Math.round(1 / data.rates.XAU) : null,
      date: data.date,
      live: true,
    }
  } catch {
    return { live: false }
  }
}

// ─── Crowd-sourced fuel & market prices (Supabase) ────────
// Users submit prices from their local market/filling station
// This is stored in Supabase — real crowd-verified data

export async function fetchFuelPrices() {
  if (!supabase) return { live: false, prices: [] }
  try {
    const { data, error } = await supabase
      .from('fuel_prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) throw error
    return { live: true, prices: data || [] }
  } catch {
    return { live: false, prices: [] }
  }
}

export async function submitFuelPrice({ product, price, state, lga, station, userId }) {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('fuel_prices').insert({
      product, price, state, lga, station,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}

export async function fetchMarketPrices() {
  if (!supabase) return { live: false, prices: [] }
  try {
    const { data, error } = await supabase
      .from('market_prices')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    return { live: true, prices: data || [] }
  } catch {
    return { live: false, prices: [] }
  }
}

export async function submitMarketPrice({ item, price, unit, market, state, lga, userId }) {
  if (!supabase) return false
  try {
    const { error } = await supabase.from('market_prices').insert({
      item, price, unit, market, state, lga,
      user_id: userId,
      created_at: new Date().toISOString(),
    })
    return !error
  } catch { return false }
}
