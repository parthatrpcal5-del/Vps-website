# Apex Hosting

Hosting company platform. One backend file (`app.js`). First run auto-builds views, CSS and JS.

## Run locally
    npm install
    ADMIN_PASSWORD=ChangeMe123 npm start
Open http://localhost:3000 — admin panel at /admin (email: admin@example.com unless ADMIN_EMAIL set).

## Deploy (real use): Render / Railway / VPS
1. Push these files to GitHub.
2. Create a Web Service from the repo. Build: `npm install`. Start: `npm start`.
3. Set env vars from `.env.example`.
4. Attach a persistent disk mounted at the `data/` folder, or SQLite resets on every deploy.

## Vercel (demo only)
Works, but data resets on cold start. Not for real orders.

## Regenerate views/CSS after editing app.js
    npm run rebuild
