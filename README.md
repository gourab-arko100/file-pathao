# File Pathao

Send files between your PC and phone — no cables, no Bluetooth. Open the
site on your PC, scan the QR code with your phone, and files transfer
**directly between the two devices** over WebRTC. Vercel is only used to
host the site and to help the two browsers find each other (signaling);
your file bytes never touch the server.

## How it works

1. PC opens `/` → generates a random room ID and shows it as a QR code
   pointing at `/room/<id>`.
2. Phone scans the QR (must be online — same Wi-Fi or mobile data both
   work) → opens that room page.
3. Both browsers exchange a WebRTC "offer/answer" handshake through a
   tiny signaling API (`/api/signal`), backed by **Vercel KV**.
4. Once connected, a direct **WebRTC DataChannel** opens between the two
   devices. Files are chunked and streamed straight across it.
5. The receiving device gets a live progress bar and a download link.

## Getting the `.env` values

### `KV_REST_API_URL`, `KV_REST_API_TOKEN`, etc. (Redis for signaling)

Vercel KV as a standalone product was sunset — signaling storage is now
the **Upstash Redis integration** via the Vercel Marketplace, but it still
injects env vars with the same `KV_...` names, so nothing in the code
needs to change.

1. Push this project to GitHub and import it into Vercel first (see
   **Deploy** below) — the database needs a project to attach to.
2. In the Vercel dashboard, open your project → **Storage** tab →
   **Create Database**.
3. Under storage partners, pick **Upstash** (Redis). Choose the free/hobby
   tier and a region close to you.
4. Click **Connect** and select this project — Vercel automatically adds
   `KV_REST_API_URL`, `KV_REST_API_TOKEN`, `KV_REST_API_READ_ONLY_TOKEN`,
   and `KV_URL` to the project's Environment Variables. You don't
   copy/paste these by hand.
5. To also use them locally: install the Vercel CLI (`npm i -g vercel`),
   then in this folder run:
   ```bash
   vercel link      # connects this folder to the Vercel project
   vercel env pull .env.local
   ```
   This writes all four values into `.env.local` for you.

(If you'd rather copy the raw values, they're under **Storage → your
database → the `.env.local` tab** in the dashboard — but `vercel env pull`
is faster and less error-prone.)

### `NEXT_PUBLIC_TURN_*` (optional TURN fallback)

Only needed if testing shows the two devices can't connect directly (this
happens on some strict corporate/campus Wi-Fi). STUN-only, already wired
up, works for most home and mobile networks — skip this and add it later
if you actually hit a connection failure.

1. Sign up free at [dashboard.metered.ca/signup](https://dashboard.metered.ca/signup)
   (20 GB/month free TURN usage on the Open Relay plan).
2. On the dashboard, create your first app/credential.
3. It shows you an ICE servers array like:
   ```js
   { urls: "turn:global.relay.metered.ca:443", username: "...", credential: "..." }
   ```
4. Copy those three values into `.env.local`:
   ```
   NEXT_PUBLIC_TURN_URL=turn:global.relay.metered.ca:443
   NEXT_PUBLIC_TURN_USERNAME=<username from dashboard>
   NEXT_PUBLIC_TURN_CREDENTIAL=<credential from dashboard>
   ```
5. Add the same three under **Settings → Environment Variables** in the
   Vercel dashboard so production has them too, then redeploy.

## Local development

```bash
npm install
```

You need the Redis env vars above in `.env.local` even for local dev,
since the signaling API route reads them on every request.

```bash
npm run dev
```

Open `http://localhost:3000` on your PC. Note: your phone won't be able
to reach `localhost`, so for a real cross-device test, deploy to Vercel
(below) or expose your dev server with a tunnel (e.g. `ngrok http 3000`).

## Deploy to Vercel

1. Push this folder to a new GitHub repo (see commands below).
2. In Vercel, **Add New Project** → import that repo.
3. Before or after the first deploy, go to the project's **Storage** tab
   → **Create Database** → pick the **Upstash** Redis integration and
   connect it to the project (see "Getting the `.env` values" above for
   the full walkthrough) — Vercel auto-injects the `KV_REST_API_URL` /
   `KV_REST_API_TOKEN` env vars for you.
4. Redeploy (Vercel does this automatically when you connect storage,
   or trigger it manually from the Deployments tab).
5. Open the deployed URL on your PC, scan the QR with your phone. Done.

### Push to GitHub

```bash
cd file-pathao
git init
git add .
git commit -m "Initial commit: File Pathao"
git branch -M main
git remote add origin https://github.com/gourab-arko100/file-pathao.git
git push -u origin main
```

(Create the empty `file-pathao` repo on GitHub first, or use
`gh repo create file-pathao --public --source=. --push` if you have the
GitHub CLI.)

## Notes / limits

- **Same network isn't required** — WebRTC uses STUN (Google's public
  STUN servers, already configured) to punch through most home/mobile
  NATs. Some restrictive networks (strict corporate firewalls, some
  mobile carriers) block direct P2P; add a TURN server via the
  `NEXT_PUBLIC_TURN_URL` / `NEXT_PUBLIC_TURN_USERNAME` /
  `NEXT_PUBLIC_TURN_CREDENTIAL` env vars for a reliable fallback (a free
  tier from e.g. metered.ca's Open Relay works fine).
- A signaling room expires from KV after 15 minutes (see
  `lib/kv.ts` → `ROOM_TTL_SECONDS`) — just refresh the PC page for a new
  QR code if a session goes stale.
- One file transfers at a time per connection; queue more by picking
  the next file once the current one finishes.
- Nothing is stored server-side — files stream directly between the two
  browser tabs and disappear once the tab closes.
