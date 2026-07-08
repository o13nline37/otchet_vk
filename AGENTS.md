# Repository Guidelines

## Project Structure & Module Organization

This is a static browser app for generating VK report `.xlsx` files, plus a small Node backend that gates access behind Google sign-in.

- `index.html` contains the application markup and CDN script links.
- `css/styles.css` contains all page styling and responsive layout rules.
- `js/authGate.js` is the frontend entry point: it renders the sign-in gate, requests a Google access token covering both profile and Sheets scope in one consent (`GOOGLE_SHEETS_SCOPE` in `js/config.js`), exchanges it with the backend, stores the session token, seeds `js/googleAuth.js`'s token cache with the same access token (so exporting to Sheets right after login needs no second prompt), and only then starts the app.
- `js/apiClient.js` holds the session token (`localStorage`) and `authFetch()`, a `fetch` wrapper that prefixes `API_BASE_URL` and attaches the `Authorization` header. Shared by `js/authGate.js` and `js/userSettings.js` — don't duplicate token handling elsewhere.
- `js/config.js` holds shared frontend config: `GOOGLE_CLIENT_ID`, `GOOGLE_SHEETS_SCOPE` (both used by login and Sheets export), and `API_BASE_URL` (backend address, auto-detected for localhost vs prod).
- `js/userSettings.js` loads the signed-in user's saved form preferences (VAT/AK multipliers, Excel style, number/output format) into the form on start, and saves them back after a valid submit — so the form remembers each person's last-used values.
- `js/app.js` exports `initApp()`: form handling, validation, file flow, and report generation orchestration. It no longer self-starts — `authGate.js` calls `initApp()` after a successful login.
- `js/ui.js` manages DOM-only behavior such as notifications, file labels, hints, and reset state.
- `js/reportProcessor.js` contains report business logic and aggregation.
- `js/excelGenerator.js` creates and styles the final workbook with ExcelJS.
- `js/googleAuth.js` manages the Google Sheets access token: `authGate.js` seeds its cache at login (`setCachedAccessToken`), and `ensureAccessToken()` only falls back to a fresh (usually silent) request once that token expires.
- `js/fileReader.js`, `js/phoneUtils.js`, and `js/formatters.js` hold focused utility functions.
- `VK.html` is the original single-file source snapshot; avoid editing it unless explicitly updating the legacy version.

The backend lives under `server/` (Express, ES modules, no build step). See `server/README.md` for setup.

- `server/src/index.js` assembles the Express app (CORS, routes, health check).
- `server/src/config.js` reads and validates environment variables from `server/.env`.
- `server/src/db.js` holds the `pg` pool and queries for `users` and `user_settings`; `server/db/schema.sql` is the table definitions; `server/src/initdb.js` applies it (`npm run db:init`).
- `server/src/auth/` contains `googleVerify.js` (verifies the Google access token via Google's `tokeninfo`/`userinfo` endpoints — checks audience and pulls the profile), `allowlist.js` (108 Media whitelist by domain/email), `jwt.js` (issues/verifies our own session JWT), and `routes.js` (`POST /api/auth/google`, `GET /api/auth/me`, `POST /api/auth/logout`).
- `server/src/settings/` contains `validate.js` (defaults + clamping/whitelisting incoming values) and `routes.js` (`GET`/`PUT /api/settings`, both behind `requireAuth`) — one row per user in `user_settings`.
- `server/src/middleware/requireAuth.js` guards protected routes (settings, and any future ones) with the session JWT.

## Build, Test, and Development Commands

No build step is required. Run the frontend through a local HTTP server because `index.html` uses ES modules:

```bash
python -m http.server 8000
```

Open `http://127.0.0.1:8000/index.html`. The login gate calls the backend, so start the backend too.

Backend (first run: copy `server/.env.example` to `server/.env` and fill it in — see `server/README.md`):

```bash
cd server
npm install
npm run db:init   # applies db/schema.sql to DATABASE_URL (run once / after schema changes)
npm run dev       # starts the API on PORT (default 3000) with --watch
```

Check JavaScript syntax before handing off changes:

```bash
node --check js/authGate.js
node --check js/app.js
node --check js/ui.js
node --check js/excelGenerator.js
node --check js/reportProcessor.js
node --check server/src/index.js
node --check server/src/auth/routes.js
```

## Coding Style & Naming Conventions

Use ES modules with explicit `import`/`export`. Keep functions small and grouped by responsibility. Use 4-space indentation in HTML, CSS, and JS. Prefer descriptive camelCase names for JavaScript variables and functions, for example `getExcelStyleSettings` or `normalizePhoneCached`.

Keep DOM manipulation in `ui.js` or `app.js`; keep calculation logic out of UI files. Preserve UTF-8 text and Russian UI labels.

## Testing Guidelines

There is no formal automated test suite yet. For each change, perform:

- JS syntax checks with `node --check`.
- Manual browser testing through the local server.
- A sample `.xlsx` generation using representative Ads, Groups, and optional Leads files.

If adding tests later, place them under `tests/` and name files after the module, for example `reportProcessor.test.js`.

## Commit & Pull Request Guidelines

This folder currently has no Git history, so no existing commit convention is available. Use concise imperative commit messages such as `Add Excel style controls` or `Refactor report aggregation`.

Pull requests should include a short description, changed files or modules, manual test notes, and screenshots for UI changes. Mention any changes to expected input columns or generated Excel formatting.

## Security & Configuration Tips

Input files are processed in the browser; do not add server upload behavior without explicit approval. External libraries are loaded from CDN in `index.html`, so keep versions pinned when updating dependencies.

The backend never trusts the frontend: it verifies the Google access token directly against Google (`tokeninfo` for audience, `userinfo` for identity) and checks the 108 Media whitelist before issuing a session token. Secrets (`JWT_SECRET`, `DATABASE_URL`) live only in `server/.env`, which is gitignored — never commit it. `GOOGLE_CLIENT_ID` is intentionally public. The session token is a Bearer JWT stored in `localStorage` (not a cookie), so logout is client-side; there is no server-side token revocation yet. The gate is enforced by the backend — the frontend show/hide is only UX, so keep any access checks on the server.
