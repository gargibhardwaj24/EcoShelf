// EcoShelf client data layer: a thin REST client for the Express + PostgreSQL backend (/server).
// The server owns all rules and data; this file keeps a synced snapshot for React and exposes
// one function per API action.
import { useSyncExternalStore } from 'react'

const TOKEN = 'ecoshelf-token-v2'
const DAY = 86400000

export const CATEGORIES = ['Drafting Tools', 'Textbooks', 'PYQ / Notes', 'Calculators', 'Lab Equipment', 'Components & Tools', 'Sports', 'Stationery']
export const CONDITIONS = ['Like New', 'Good', 'Fair', 'Worn']
export const TYPES = { sell: 'Sell', rent: 'Rent', lend: 'Lend', donate: 'Donate' }
export const TYPE_HINT = {
  sell: 'Permanent sale for a price',
  rent: 'Paid, for a set period',
  lend: 'Free loan, returned later',
  donate: 'Give it away for free',
}
export const MEETUP_SPOTS = ['Main Library', 'Canteen', 'Admin Block Lobby', 'Hostel Gate', 'Workshop / Lab Block', 'Sports Complex']

/* ---------- placeholder art for listings without a photo ---------- */
function svgImg(emoji, c1, c2) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='300'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs><rect width='400' height='300' fill='url(#g)'/><text x='200' y='185' font-size='120' text-anchor='middle'>${emoji}</text></svg>`
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg)
}
const CAT_ART = {
  'Drafting Tools': ['📐', '#EAF4EE', '#cfe6d8'], Textbooks: ['📚', '#FDEBD3', '#F9D6A8'],
  'PYQ / Notes': ['📝', '#fff4d6', '#fbe5a8'], Calculators: ['🧮', '#e3edf7', '#c3d6ea'],
  'Lab Equipment': ['🥼', '#eee6f4', '#d9c9e8'], 'Components & Tools': ['🔧', '#ece6df', '#d6cabc'],
  Sports: ['🏸', '#fde3d3', '#f7c3a6'], Stationery: ['✏️', '#fbe3ea', '#f3bfcf'],
}
export const placeholderFor = (cat) => svgImg(...(CAT_ART[cat] || ['📦', '#eee', '#ddd']))

/* ---------- API client + synced state ---------- */
let db = null
let session = null
let snapshot = { db: null, session: null, ready: false }
const listeners = new Set()
const getToken = () => { try { return localStorage.getItem(TOKEN) } catch { return null } }
const setToken = (t) => { try { if (t) localStorage.setItem(TOKEN, t); else localStorage.removeItem(TOKEN) } catch { /* ignore */ } }
const emit = () => { snapshot = { db, session, ready: true }; listeners.forEach((l) => l()) }

async function api(path, method = 'GET', body) {
  const t = getToken()
  const res = await fetch('/api' + path, {
    method, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: 'Bearer ' + t } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  }).catch(() => { throw new Error('Cannot reach the EcoShelf server. Is it running? (npm run dev)') })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) { const e = new Error(data.error || 'Something went wrong.'); e.status = res.status; throw e }
  return data
}
export async function refresh() {
  if (!getToken()) { db = null; session = null; return emit() }
  try {
    const data = await api('/state')
    session = data.me; db = data
  } catch (e) {
    if (e.status === 401) { setToken(null); db = null; session = null } else if (!db) throw e
  }
  emit()
}
// run a mutation, then re-sync; surface errors to the user
async function act(path, body, method = 'POST') {
  try { const r = await api(path, method, body); await refresh(); return r } catch (e) { alert(e.message); await refresh().catch(() => {}) }
}
refresh().catch(() => emit())
setInterval(() => { if (getToken() && !document.hidden) refresh().catch(() => {}) }, 6000)

export function useStore() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l) }, () => snapshot)
}

/* ---------- selectors ---------- */
export const getUser = (d, id) => d.users.find((u) => u.id === id)
export const currentUser = (s) => (s.db && s.session ? getUser(s.db, s.session) : null)
export function userRating(d, userId) {
  const r = d.reviews.filter((x) => x.toId === userId)
  return { avg: r.length ? r.reduce((a, x) => a + x.rating, 0) / r.length : 0, count: r.length }
}
export function itemRating(d, itemId) {
  const r = d.reviews.filter((x) => x.itemId === itemId && x.kind === 'item')
  return { avg: r.length ? r.reduce((a, x) => a + x.rating, 0) / r.length : 0, count: r.length }
}
export const isCompleted = (r) => ['completed', 'returned'].includes(r.status)
// derived stage for the Available -> Requested -> Rented -> Return Due -> Returned display
export function stageOf(r) {
  if (r.status === 'active') return r.endDate - Date.now() <= 2 * DAY ? (r.endDate < Date.now() ? 'overdue' : 'return due') : 'rented'
  return r.status
}
export function requestAmount(item, days) {
  if (item.type === 'sell') return item.price
  if (item.type === 'rent') return Math.ceil((item.price / 7) * days)
  return 0
}
export const ecoStats = (d) => d.impact
export const fetchPublic = () => api('/public')

/* ---------- actions (each is one REST call) ---------- */
async function authCall(path, body) {
  const { token } = await api(path, 'POST', body)
  setToken(token); await refresh()
}
export const register = (f) => authCall('/auth/register', f)
export const login = (email, password) => authCall('/auth/login', { email, password })
export function logout() { setToken(null); db = null; session = null; emit() }

export const createItem = async (data) => (await act('/items', data))?.id
export const updateItem = (id, data) => act('/items/' + id, data, 'PATCH')
export const deleteItem = (id) => act('/items/' + id, undefined, 'DELETE')
export const createRequest = (itemId, { days = 7, message = '' }) => act('/requests', { itemId, days, message })
export const respondRequest = (id, accept, meetup) => act(`/requests/${id}/respond`, { accept, meetup })
export const cancelRequest = (id) => act(`/requests/${id}/cancel`)
export const confirmHandover = (id) => act(`/requests/${id}/handover`)
export const confirmReturn = (id) => act(`/requests/${id}/return`)
export const sendMessage = (id, text) => (text.trim() ? act(`/requests/${id}/messages`, { text }) : null)
export const submitReview = (id, { rating, feedback }) => act(`/requests/${id}/reviews`, { rating, feedback })
export const reportItem = (itemId, reason) => act('/reports', { itemId, reason })
export const resolveReport = (id, remove) => act(`/reports/${id}/resolve`, { remove })
export const markNotificationsRead = () => act('/notifications/read')
