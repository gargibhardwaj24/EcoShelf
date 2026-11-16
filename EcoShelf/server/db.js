// Database access. Uses PostgreSQL when DATABASE_URL is set (docker-compose.yml provides one);
// otherwise falls back to PGlite (real Postgres compiled to WASM) persisted in server/data,
// so the project runs with zero installs.
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, "passHash" TEXT NOT NULL,
  college TEXT, branch TEXT, year INT, role TEXT NOT NULL DEFAULT 'student', "createdAt" DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, "sellerId" TEXT NOT NULL REFERENCES users(id), title TEXT NOT NULL, category TEXT NOT NULL,
  course TEXT, semester INT DEFAULT 0, condition TEXT, type TEXT NOT NULL, price INT DEFAULT 0, "originalPrice" INT DEFAULT 0,
  description TEXT, image TEXT, status TEXT NOT NULL DEFAULT 'available', "createdAt" DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS requests (
  id TEXT PRIMARY KEY, "itemId" TEXT NOT NULL REFERENCES items(id), "borrowerId" TEXT NOT NULL REFERENCES users(id),
  "ownerId" TEXT NOT NULL REFERENCES users(id), status TEXT NOT NULL, days INT DEFAULT 0, amount INT DEFAULT 0,
  "meetupPlace" TEXT, "meetupTime" DOUBLE PRECISION, "startDate" DOUBLE PRECISION, "endDate" DOUBLE PRECISION,
  "completedAt" DOUBLE PRECISION, reminded BOOLEAN DEFAULT FALSE, "createdAt" DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), "fromId" TEXT NOT NULL, text TEXT NOT NULL, at DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, "requestId" TEXT NOT NULL REFERENCES requests(id), "fromId" TEXT NOT NULL, "toId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL, rating INT NOT NULL, feedback TEXT, kind TEXT NOT NULL, at DOUBLE PRECISION NOT NULL,
  UNIQUE ("requestId", "fromId"));
CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY, "itemId" TEXT NOT NULL, "reporterId" TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open', at DOUBLE PRECISION NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, "userId" TEXT NOT NULL, text TEXT NOT NULL, link TEXT, at DOUBLE PRECISION NOT NULL, read BOOLEAN DEFAULT FALSE);
CREATE INDEX IF NOT EXISTS idx_req_owner ON requests("ownerId");
CREATE INDEX IF NOT EXISTS idx_req_borrower ON requests("borrowerId");
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
`

export async function createDb() {
  let query, exec, kind, close
  if (process.env.DATABASE_URL) {
    const pg = (await import('pg')).default
    const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
    query = (s, p) => pool.query(s, p).then((r) => r.rows)
    exec = (s) => pool.query(s)
    close = () => pool.end()
    kind = 'PostgreSQL (DATABASE_URL)'
  } else {
    const { PGlite } = await import('@electric-sql/pglite')
    const dir = process.env.PGLITE_DIR || './server/data'
    const { renameSync, existsSync } = await import('node:fs')
    const { spawnSync } = await import('node:child_process')
    // Health-check the files in a separate, short-lived process. A failed open inside this
    // process would keep the files locked, so we couldn't move a damaged folder aside.
    if (existsSync(dir)) {
      const check = `import { PGlite } from '@electric-sql/pglite'; const d = new PGlite(${JSON.stringify(dir)}); await d.waitReady; await d.query('SELECT 1'); await d.close()`
      const r = spawnSync(process.execPath, ['--input-type=module', '-e', check], { cwd: process.cwd(), stdio: 'ignore', timeout: 60000 })
      if (r.status !== 0) {
        // Damaged files (e.g. after a force-kill): keep them aside and start a fresh demo database.
        const aside = `${dir}-damaged-${new Date().toISOString().replace(/[:.]/g, '-')}`
        try {
          renameSync(dir, aside)
          console.warn(`\n! The database in ${dir} could not be opened. It was moved to ${aside} and a fresh demo database is being created.\n`)
        } catch (e) {
          console.error(`\nThe database in ${dir} could not be opened, and could not be moved aside because another program has its files open.`)
          console.error('Close other terminals / dev servers running EcoShelf (and any editor watching server/data), then run `npm run dev` again.\n')
          throw e
        }
      }
    }
    const db = new PGlite(dir)
    await db.waitReady
    close = () => db.close()
    query = (s, p) => db.query(s, p).then((r) => r.rows)
    exec = (s) => db.exec(s)
    kind = 'PGlite (embedded Postgres, ./server/data)'
  }
  await exec(SCHEMA)
  const [{ n }] = await query('SELECT COUNT(*)::int AS n FROM users')
  if (!n) await seed(query)
  return { query, kind, close }
}

async function seed(query) {
  const now = Date.now(), DAY = 86400000
  const pw = bcrypt.hashSync('demo1234', 10)
  const users = [
    ['u_admin', 'Campus Admin', 'admin@campus.edu', 'Administration', 0, 'admin'],
    ['u_aarav', 'Aarav Sharma', 'aarav@campus.edu', 'Mechanical', 4, 'student'],
    ['u_meera', 'Meera Nair', 'meera@campus.edu', 'Electronics', 3, 'student'],
    ['u_rohan', 'Rohan Gupta', 'rohan@campus.edu', 'Computer Science', 1, 'student'],
  ]
  for (const [id, name, email, branch, year, role] of users)
    await query('INSERT INTO users VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)', [id, name, email, pw, 'Demo Institute of Technology', branch, year, role, now - 60 * DAY])
  const items = [
    ['u_aarav', 'Mini Drafter + Set Squares', 'Drafting Tools', 'Engineering Graphics', 1, 'Good', 'rent', 40, 900, 'Complete first-year drafting kit. Rent is per week.', 12],
    ['u_aarav', 'Engineering Mathematics - B.S. Grewal', 'Textbooks', 'Engineering Mathematics', 1, 'Fair', 'sell', 250, 700, 'Some highlighting, all pages intact.', 9],
    ['u_meera', 'Casio fx-991EX Calculator', 'Calculators', 'General', 0, 'Like New', 'lend', 0, 1700, 'Happy to lend for exams. Please return within a week.', 7],
    ['u_meera', 'Lab Coat (Size M)', 'Lab Equipment', 'Basic Electronics Lab', 2, 'Good', 'donate', 0, 450, 'Washed and ready for a new owner.', 5],
    ['u_aarav', 'Last 10 Years PYQ - Thermodynamics', 'PYQ / Notes', 'Thermodynamics', 4, 'Good', 'sell', 80, 250, 'Solved previous year question papers.', 3],
    ['u_meera', 'Arduino Uno Starter Kit', 'Components & Tools', 'Microcontrollers', 4, 'Good', 'rent', 100, 2200, 'Board, breadboard, jumper wires, sensors. Rent per week.', 2],
    ['u_aarav', 'Badminton Racquet (Yonex)', 'Sports', 'General', 0, 'Fair', 'lend', 0, 1200, 'Good for casual games.', 1],
  ]
  for (const [s, t, c, co, sem, cond, type, price, orig, desc, ago] of items)
    await query(
      `INSERT INTO items (id,"sellerId",title,category,course,semester,condition,type,price,"originalPrice",description,status,"createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'available',$12)`,
      [randomUUID(), s, t, c, co, sem, cond, type, price, orig, desc, now - ago * DAY])
}
