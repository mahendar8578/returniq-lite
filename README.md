# ReturnIQ Lite
Product return reason analysis for small retailers. React + Node/Express + MongoDB.

## Run
1. Start MongoDB locally (or use an Atlas URI).
2. Backend:  `cd server && cp .env.example .env && npm install && npm run seed && npm run dev`  (http://localhost:5000)
3. Frontend: `cd client && npm install && npm run dev`  (http://localhost:5173, proxies /api to :5000)

## REST API
| Method | Path | Purpose |
|---|---|---|
| GET/POST | /api/products | list / create product (name, sku, supplier, unitsSold) |
| PUT/DELETE | /api/products/:id | update / delete (also deletes its returns) |
| GET/POST | /api/returns | list (filters: reason, product, from, to) / log a return |
| PUT/DELETE | /api/returns/:id | update / delete a return |
| GET/PUT | /api/settings | read / change flag threshold (%) |
| GET | /api/analytics/products | per-product return rate + `flagged` |
| GET | /api/analytics/flagged | only products above threshold |
| GET | /api/analytics/summary | totals, by reason, by supplier |
| GET | /api/analytics/trends | monthly returns per reason |

Return rate = returned units / units sold x 100. A product is flagged when rate > threshold.

## Deploy (GitHub + Vercel)
1. Create a free MongoDB Atlas cluster, allow access from 0.0.0.0/0, copy the connection string.
2. Push this repo to GitHub.
3. Vercel project A: import repo, Root Directory `server`. Env vars: `MONGO_URI`, `CLIENT_URL` (frontend URL).
4. Vercel project B: import repo, Root Directory `client`, framework Vite. Env var: `VITE_API_URL` = project A's URL (no trailing slash).
5. Redeploy both after setting env vars. Seed Atlas once locally: set `MONGO_URI` in `server/.env`, run `npm run seed`.
