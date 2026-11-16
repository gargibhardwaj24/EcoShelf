# 🌿 EcoShelf — Campus Marketplace

Sell · Rent · Lend · Donate academic resources between students (see the synopsis and slide deck).

```bash
npm install
npm run dev   # starts the API (:3001) and the website (:5173) together
```

Demo logins (password `demo1234`): `aarav@campus.edu`, `meera@campus.edu`, `rohan@campus.edu`, `admin@campus.edu` (moderator).

## Features (mapped to the synopsis)
- **Auth**: college-email-only sign-up (`.edu`, `.ac.in`, `.edu.in`), hashed passwords, verified badge
- **Listings**: sell / rent / lend / donate, photo upload, category, course, semester, condition, prices
- **Search & filters**: text, category, course, semester, price range, condition, type, availability, sort
- **Rental lifecycle**: Requested → Accepted → Rented → Return Due → Returned (sell/donate: Requested → Accepted → Completed)
- **Campus meet-up**, per-request **chat**, **notifications** and return-due reminders
- **Ratings & reviews** (item/owner and borrower), profiles, exchange history
- **Report / moderation** queue for admins
- **Eco Impact dashboard**: items reused, students served, money saved, estimated CO₂ avoided

## Architecture
React (Vite) → Express REST API (`server/index.js`) → PostgreSQL (`server/db.js`), JWT auth with bcrypt-hashed passwords.

- **Database**: with no config it uses PGlite (embedded real Postgres, saved in `server/data/`), so no install is needed.
  For a standalone Postgres: `docker compose up -d`, then
  `DATABASE_URL=postgres://ecoshelf:ecoshelf@localhost:5432/ecoshelf JWT_SECRET=<long random> npm run server`.
- **Tables**: users, items, requests (rental lifecycle + meet-up), messages, reviews, reports, notifications.
- Only one server can use the embedded database at a time. Stop it with Ctrl+C (it closes the database cleanly); if it ever refuses to start, rename `server/data/` to start fresh.
- The server enforces every rule (college-email check, owner-only actions, lifecycle transitions). Set `JWT_SECRET` outside local dev.
- Theme follows the project deck (cream, slate, orange, green; Cambria headings).
- CO₂ figures are illustrative per-category estimates.
