import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { createDb } from './db.js'

const PORT = process.env.PORT || 3001
const SECRET = process.env.JWT_SECRET || 'dev-only-secret-change-me'
if (!process.env.JWT_SECRET) console.warn('! JWT_SECRET not set, using an insecure dev secret')
const DAY = 86400000
const TYPES = ['sell', 'rent', 'lend', 'donate']
const CO2 = { 'Drafting Tools': 1.2, Textbooks: 2.5, 'PYQ / Notes': 0.8, Calculators: 4, 'Lab Equipment': 3, 'Components & Tools': 3.5, Sports: 5, Stationery: 0.5 }
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.(edu|ac\.in|edu\.in|ac\.uk)$/i

// refuse to start (and touch the database) if another EcoShelf API already owns the port
const net = await import('node:net')
const portBusy = await new Promise((resolve) => {
  const probe = net.createServer().once('error', () => resolve(true)).once('listening', () => probe.close(() => resolve(false)))
  probe.listen(PORT)
})
if (portBusy) {
  console.error(`\nPort ${PORT} is already in use: an EcoShelf API is probably running already. Stop it first (Ctrl+C in its terminal).\n`)
  process.exit(1)
}

const { query, kind, close } = await createDb()
// close the database cleanly on Ctrl+C / stop, so the embedded Postgres files stay valid
let closing = false
for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) process.on(sig, async () => {
  if (closing) return
  closing = true
  try { await close() } finally { process.exit(0) }
})
const q1 = async (s, p) => (await query(s, p))[0]
const id = () => randomUUID()
const fail = (status, message) => { throw Object.assign(new Error(message), { status }) }
const str = (v, max, name) => { v = String(v ?? '').trim(); if (v.length > max) fail(400, `${name} is too long.`); return v }
const int = (v, lo, hi, name) => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n < lo || n > hi) fail(400, `${name} must be between ${lo} and ${hi}.`); return n }
const notify = (userId, text, link) => query('INSERT INTO notifications VALUES ($1,$2,$3,$4,$5,false)', [id(), userId, text, link, Date.now()])

const app = express()
app.use(cors())
app.use(express.json({ limit: '4mb' }))
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  if (!e.status) console.error(e)
  res.status(e.status || 500).json({ error: e.status ? e.message : 'Server error' })
})
const sign = (u) => jwt.sign({ sub: u.id }, SECRET, { expiresIn: '7d' })
const auth = async (req, _res, next) => {
  try {
    const t = (req.headers.authorization || '').replace('Bearer ', '')
    const { sub } = jwt.verify(t, SECRET)
    req.user = await q1('SELECT id,name,role FROM users WHERE id=$1', [sub])
    if (!req.user) throw new Error('no user')
    next()
  } catch { next(Object.assign(new Error('Please log in again.'), { status: 401 })) }
}

/* ---------- auth ---------- */
const loginAttempts = new Map() // tiny brute-force guard: 10 tries / 15 min per IP+email
app.post('/api/auth/register', wrap(async (req, res) => {
  const b = req.body
  const email = str(b.email, 120, 'Email').toLowerCase()
  if (!str(b.name, 80, 'Name')) fail(400, 'Please enter your name.')
  if (!EMAIL_RE.test(email)) fail(400, 'Use your college email (.edu, .ac.in or .edu.in) to join the campus marketplace.')
  if (String(b.password || '').length < 6) fail(400, 'Password must be at least 6 characters.')
  if (await q1('SELECT 1 FROM users WHERE email=$1', [email])) fail(409, 'An account with this email already exists.')
  const u = { id: id(), name: str(b.name, 80, 'Name'), email }
  await query('INSERT INTO users VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)',
    [u.id, u.name, email, bcrypt.hashSync(b.password, 10), str(b.college, 120, 'College') || 'My College', str(b.branch, 80, 'Branch'), int(b.year || 1, 1, 8, 'Year'), 'student', Date.now()])
  res.json({ token: sign(u) })
}))
app.post('/api/auth/login', wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase()
  const key = req.ip + email, rec = loginAttempts.get(key) || { n: 0, t: Date.now() }
  if (Date.now() - rec.t > 15 * 60000) { rec.n = 0; rec.t = Date.now() }
  if (rec.n >= 10) fail(429, 'Too many attempts. Try again in a few minutes.')
  const u = await q1('SELECT * FROM users WHERE email=$1', [email])
  if (!u || !bcrypt.compareSync(String(req.body.password || ''), u.passHash)) { loginAttempts.set(key, { ...rec, n: rec.n + 1 }); fail(401, 'Invalid email or password.') }
  loginAttempts.delete(key)
  res.json({ token: sign(u) })
}))

/* ---------- state (everything the signed-in user may see) ---------- */
async function impact() {
  const rows = await query(`SELECT r."borrowerId", r.amount, i.category, i."originalPrice" FROM requests r JOIN items i ON i.id=r."itemId" WHERE r.status IN ('completed','returned')`)
  const byCat = {}; let saved = 0, co2 = 0
  rows.forEach((r) => { saved += Math.max(0, r.originalPrice - r.amount); co2 += CO2[r.category] || 1; byCat[r.category] = (byCat[r.category] || 0) + 1 })
  const [l] = await query(`SELECT COUNT(*)::int AS n FROM items WHERE status<>'removed'`)
  const [a] = await query(`SELECT COUNT(*)::int AS n FROM requests WHERE status='active'`)
  return { reused: rows.length, students: new Set(rows.map((r) => r.borrowerId)).size, saved: Math.round(saved), co2: Math.round(co2 * 10) / 10, byCat, listed: l.n, active: a.n }
}
app.get('/api/state', auth, wrap(async (req, res) => {
  const me = req.user.id
  // lazily create return-due reminders for this borrower
  const due = await query(`SELECT r.id, r."endDate", i.title FROM requests r JOIN items i ON i.id=r."itemId" WHERE r."borrowerId"=$1 AND r.status='active' AND r."endDate"-$2<=$3 AND NOT r.reminded`, [me, Date.now(), 2 * DAY])
  for (const r of due) {
    await query('UPDATE requests SET reminded=true WHERE id=$1', [r.id])
    await notify(me, `Reminder: return "${r.title}" by ${new Date(r.endDate).toLocaleDateString()}.`, `/request/${r.id}`)
  }
  const reqRows = await query('SELECT * FROM requests WHERE "ownerId"=$1 OR "borrowerId"=$1 ORDER BY "createdAt" DESC', [me])
  const msgs = reqRows.length ? await query('SELECT "requestId","fromId",text,at FROM messages WHERE "requestId"=ANY($1) ORDER BY at', [reqRows.map((r) => r.id)]) : []
  const requests = reqRows.map(({ meetupPlace, meetupTime, ...r }) => ({
    ...r, meetup: meetupPlace ? { place: meetupPlace, time: meetupTime } : null,
    messages: msgs.filter((m) => m.requestId === r.id).map(({ fromId, text, at }) => ({ from: fromId, text, at })),
  }))
  const admin = req.user.role === 'admin'
  res.json({
    me,
    users: await query('SELECT id,name,email,college,branch,year,role,"createdAt" FROM users'),
    items: await query('SELECT * FROM items ORDER BY "createdAt" DESC'),
    requests,
    reviews: await query('SELECT * FROM reviews'),
    reports: admin ? await query('SELECT * FROM reports') : [],
    notifications: await query('SELECT id,"userId",text,link,at,read FROM notifications WHERE "userId"=$1 ORDER BY at DESC LIMIT 100', [me]),
    impact: await impact(),
  })
}))

// public data for the landing page (no auth): live impact + a few fresh listings
app.get('/api/public', wrap(async (_req, res) => {
  const [u] = await query(`SELECT COUNT(*)::int AS n FROM users WHERE role='student'`)
  const items = await query(`SELECT id,title,category,course,condition,type,price,"originalPrice",image FROM items WHERE status IN ('available','requested') ORDER BY "createdAt" DESC LIMIT 8`)
  res.json({ impact: await impact(), students: u.n, items })
}))

/* ---------- items ---------- */
function itemFields(b) {
  const type = b.type
  if (!TYPES.includes(type)) fail(400, 'Invalid listing type.')
  const free = type === 'lend' || type === 'donate'
  const title = str(b.title, 120, 'Title'); if (!title) fail(400, 'Title is required.')
  if (typeof b.image === 'string' && b.image.length > 3_000_000) fail(400, 'Image is too large.')
  return [title, str(b.category, 60, 'Category'), str(b.course, 120, 'Course'), int(b.semester ?? 0, 0, 8, 'Semester'), str(b.condition, 30, 'Condition'), type,
    free ? 0 : int(b.price, 1, 1_000_000, 'Price'), int(b.originalPrice || 0, 0, 10_000_000, 'Original price'), str(b.description, 2000, 'Description'),
    b.image && b.image.startsWith('data:image/') ? b.image : null]
}
app.post('/api/items', auth, wrap(async (req, res) => {
  const f = itemFields(req.body), iid = id()
  await query(`INSERT INTO items (id,"sellerId",title,category,course,semester,condition,type,price,"originalPrice",description,image,status,"createdAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'available',$13)`, [iid, req.user.id, ...f, Date.now()])
  res.json({ id: iid })
}))
app.patch('/api/items/:id', auth, wrap(async (req, res) => {
  const it = await q1('SELECT * FROM items WHERE id=$1', [req.params.id])
  if (!it || it.sellerId !== req.user.id) fail(404, 'Listing not found.')
  const f = itemFields({ ...it, ...req.body })
  await query(`UPDATE items SET title=$2,category=$3,course=$4,semester=$5,condition=$6,type=$7,price=$8,"originalPrice"=$9,description=$10,image=$11 WHERE id=$1`, [it.id, ...f])
  res.json({ ok: true })
}))
app.delete('/api/items/:id', auth, wrap(async (req, res) => {
  const it = await q1('SELECT * FROM items WHERE id=$1', [req.params.id])
  if (!it) fail(404, 'Listing not found.')
  if (it.sellerId !== req.user.id && req.user.role !== 'admin') fail(403, 'Not allowed.')
  if (await q1(`SELECT 1 FROM requests WHERE "itemId"=$1 AND status IN ('accepted','active')`, [it.id])) fail(409, 'This item has an exchange in progress.')
  await query(`UPDATE items SET status='removed' WHERE id=$1`, [it.id])
  const pend = await query(`UPDATE requests SET status='declined' WHERE "itemId"=$1 AND status='requested' RETURNING id,"borrowerId"`, [it.id])
  for (const r of pend) await notify(r.borrowerId, `"${it.title}" was removed, so your request was closed.`, '/requests')
  res.json({ ok: true })
}))

/* ---------- requests / rental lifecycle ---------- */
const amountFor = (item, days) => item.type === 'sell' ? item.price : item.type === 'rent' ? Math.ceil((item.price / 7) * days) : 0
async function syncItem(itemId) {
  const it = await q1('SELECT status FROM items WHERE id=$1', [itemId])
  if (!it || ['removed', 'sold', 'rented'].includes(it.status)) return
  const pending = await q1(`SELECT 1 FROM requests WHERE "itemId"=$1 AND status='requested'`, [itemId])
  await query('UPDATE items SET status=$2 WHERE id=$1', [itemId, pending ? 'requested' : 'available'])
}
async function loadReq(req, role) {
  const r = await q1('SELECT * FROM requests WHERE id=$1', [req.params.id])
  if (!r || ![r.ownerId, r.borrowerId].includes(req.user.id)) fail(404, 'Request not found.')
  if (role === 'owner' && r.ownerId !== req.user.id) fail(403, 'Only the owner can do this.')
  if (role === 'borrower' && r.borrowerId !== req.user.id) fail(403, 'Only the requester can do this.')
  const item = await q1('SELECT * FROM items WHERE id=$1', [r.itemId])
  return { r, item }
}
app.post('/api/requests', auth, wrap(async (req, res) => {
  const item = await q1('SELECT * FROM items WHERE id=$1', [req.body.itemId])
  if (!item || ['removed', 'sold', 'rented'].includes(item.status)) fail(409, 'This item is not available.')
  if (item.sellerId === req.user.id) fail(400, "You can't request your own item.")
  if (await q1(`SELECT 1 FROM requests WHERE "itemId"=$1 AND "borrowerId"=$2 AND status IN ('requested','accepted','active')`, [item.id, req.user.id])) fail(409, 'You already have a request on this item.')
  const timed = item.type === 'rent' || item.type === 'lend'
  const days = timed ? int(req.body.days || 7, 1, 120, 'Duration') : 0
  const rid = id()
  await query(`INSERT INTO requests (id,"itemId","borrowerId","ownerId",status,days,amount,"createdAt") VALUES ($1,$2,$3,$4,'requested',$5,$6,$7)`, [rid, item.id, req.user.id, item.sellerId, days, amountFor(item, days), Date.now()])
  const msg = str(req.body.message, 1000, 'Message')
  if (msg) await query('INSERT INTO messages VALUES ($1,$2,$3,$4,$5)', [id(), rid, req.user.id, msg, Date.now()])
  await query(`UPDATE items SET status='requested' WHERE id=$1`, [item.id])
  await notify(item.sellerId, `${req.user.name} requested "${item.title}".`, `/request/${rid}`)
  res.json({ id: rid })
}))
app.post('/api/requests/:id/respond', auth, wrap(async (req, res) => {
  const { r, item } = await loadReq(req, 'owner')
  if (r.status !== 'requested') fail(409, 'This request was already handled.')
  if (req.body.accept) {
    const place = str(req.body.meetup?.place, 80, 'Meet-up place'), time = Number(req.body.meetup?.time)
    if (!place || !Number.isFinite(time)) fail(400, 'Choose a meet-up place and time.')
    await query(`UPDATE requests SET status='accepted',"meetupPlace"=$2,"meetupTime"=$3 WHERE id=$1`, [r.id, place, time])
    const others = await query(`UPDATE requests SET status='declined' WHERE "itemId"=$1 AND id<>$2 AND status='requested' RETURNING "borrowerId"`, [item.id, r.id])
    for (const o of others) await notify(o.borrowerId, `"${item.title}" was given to someone else.`, '/requests')
    await notify(r.borrowerId, `Accepted! Meet at ${place} (${new Date(time).toLocaleString()}) for "${item.title}".`, `/request/${r.id}`)
  } else {
    await query(`UPDATE requests SET status='declined' WHERE id=$1`, [r.id])
    await notify(r.borrowerId, `Your request for "${item.title}" was declined.`, `/request/${r.id}`)
    await syncItem(item.id)
  }
  res.json({ ok: true })
}))
app.post('/api/requests/:id/cancel', auth, wrap(async (req, res) => {
  const { r, item } = await loadReq(req, 'borrower')
  if (!['requested', 'accepted'].includes(r.status)) fail(409, 'This request can no longer be cancelled.')
  await query(`UPDATE requests SET status='cancelled' WHERE id=$1`, [r.id])
  await syncItem(item.id)
  await notify(r.ownerId, `${req.user.name} cancelled the request for "${item.title}".`, `/request/${r.id}`)
  res.json({ ok: true })
}))
app.post('/api/requests/:id/handover', auth, wrap(async (req, res) => {
  const { r, item } = await loadReq(req, 'owner')
  if (r.status !== 'accepted') fail(409, 'Request is not awaiting handover.')
  if (item.type === 'rent' || item.type === 'lend') {
    const start = Date.now(), end = start + r.days * DAY
    await query(`UPDATE requests SET status='active',"startDate"=$2,"endDate"=$3 WHERE id=$1`, [r.id, start, end])
    await query(`UPDATE items SET status='rented' WHERE id=$1`, [item.id])
    await notify(r.borrowerId, `You now have "${item.title}". Return it by ${new Date(end).toLocaleDateString()}.`, `/request/${r.id}`)
  } else {
    await query(`UPDATE requests SET status='completed',"completedAt"=$2 WHERE id=$1`, [r.id, Date.now()])
    await query(`UPDATE items SET status='sold' WHERE id=$1`, [item.id])
    await notify(r.borrowerId, `Transaction complete for "${item.title}". Please rate your experience.`, `/request/${r.id}`)
  }
  res.json({ ok: true })
}))
app.post('/api/requests/:id/return', auth, wrap(async (req, res) => {
  const { r, item } = await loadReq(req, 'owner')
  if (r.status !== 'active') fail(409, 'Item is not currently on loan.')
  await query(`UPDATE requests SET status='returned',"completedAt"=$2 WHERE id=$1`, [r.id, Date.now()])
  await query(`UPDATE items SET status='available' WHERE id=$1`, [item.id])
  await syncItem(item.id)
  await notify(r.borrowerId, `Return of "${item.title}" confirmed. Thanks! Please rate your experience.`, `/request/${r.id}`)
  res.json({ ok: true })
}))
app.post('/api/requests/:id/messages', auth, wrap(async (req, res) => {
  const { r } = await loadReq(req)
  const text = str(req.body.text, 1000, 'Message'); if (!text) fail(400, 'Empty message.')
  await query('INSERT INTO messages VALUES ($1,$2,$3,$4,$5)', [id(), r.id, req.user.id, text, Date.now()])
  await notify(req.user.id === r.ownerId ? r.borrowerId : r.ownerId, `New message from ${req.user.name}.`, `/request/${r.id}`)
  res.json({ ok: true })
}))
app.post('/api/requests/:id/reviews', auth, wrap(async (req, res) => {
  const { r } = await loadReq(req)
  if (!['completed', 'returned'].includes(r.status)) fail(409, 'You can review after the exchange is complete.')
  const rating = int(req.body.rating, 1, 5, 'Rating')
  const to = req.user.id === r.ownerId ? r.borrowerId : r.ownerId
  if (await q1('SELECT 1 FROM reviews WHERE "requestId"=$1 AND "fromId"=$2', [r.id, req.user.id])) fail(409, 'You already reviewed this.')
  await query('INSERT INTO reviews VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id(), r.id, req.user.id, to, r.itemId, rating, str(req.body.feedback, 500, 'Feedback'), req.user.id === r.borrowerId ? 'item' : 'user', Date.now()])
  await notify(to, `${req.user.name} rated you ${rating}★.`, `/profile/${to}`)
  res.json({ ok: true })
}))

/* ---------- moderation & notifications ---------- */
app.post('/api/reports', auth, wrap(async (req, res) => {
  const reason = str(req.body.reason, 500, 'Reason'); if (!reason) fail(400, 'Please give a reason.')
  if (!(await q1('SELECT 1 FROM items WHERE id=$1', [req.body.itemId]))) fail(404, 'Listing not found.')
  if (!(await q1(`SELECT 1 FROM reports WHERE "itemId"=$1 AND "reporterId"=$2 AND status='open'`, [req.body.itemId, req.user.id])))
    await query('INSERT INTO reports VALUES ($1,$2,$3,$4,$5,$6)', [id(), req.body.itemId, req.user.id, reason, 'open', Date.now()])
  res.json({ ok: true })
}))
app.post('/api/reports/:id/resolve', auth, wrap(async (req, res) => {
  if (req.user.role !== 'admin') fail(403, 'Admins only.')
  const rep = await q1('SELECT * FROM reports WHERE id=$1', [req.params.id])
  if (!rep) fail(404, 'Report not found.')
  await query('UPDATE reports SET status=$2 WHERE id=$1', [rep.id, req.body.remove ? 'removed' : 'dismissed'])
  if (req.body.remove) {
    const it = await q1(`UPDATE items SET status='removed' WHERE id=$1 RETURNING title,"sellerId"`, [rep.itemId])
    if (it) await notify(it.sellerId, `Your listing "${it.title}" was removed by moderators.`, '/my')
  }
  res.json({ ok: true })
}))
app.post('/api/notifications/read', auth, wrap(async (req, res) => {
  await query('UPDATE notifications SET read=true WHERE "userId"=$1', [req.user.id])
  res.json({ ok: true })
}))

app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }))
app.use((err, _req, res, _next) => res.status(err.status || 400).json({ error: err.message }))
app.listen(PORT, () => console.log(`EcoShelf API on http://localhost:${PORT}  ·  DB: ${kind}`))
