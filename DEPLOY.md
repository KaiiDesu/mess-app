# Deploy Online (Fast Path)

## Option A: Render for both Backend + Frontend

1. Push this repository to GitHub.
2. In Render, choose New + Blueprint and select your repo.
3. Render will detect render.yaml and create:
   - `mess-app-backend` (Node web service)
   - `mess-app-frontend` (static site)
4. In backend env vars, set real values:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `JWT_SECRET`
5. After frontend is deployed, copy the frontend domain and update backend `SOCKET_IO_CORS` to that URL.
6. Redeploy backend.

## Option B: Netlify Frontend + Render Backend

1. Deploy backend (`server/`) to Render as a Node web service.
2. Deploy frontend (repo root) to Netlify as static site.
3. Open your frontend URL once with query param:

   `https://YOUR_FRONTEND_DOMAIN/zap-messenger-prototype.html?api=https://YOUR_BACKEND_DOMAIN`

4. The app stores this in localStorage (`zap_api_url`) so future visits no longer need the query parameter.

## Required backend env vars

- `NODE_ENV=production`
- `PORT=3000`
- `SUPABASE_URL=...`
- `SUPABASE_ANON_KEY=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`
- `JWT_SECRET=...`
- `JWT_EXPIRES_IN=7d`
- `SOCKET_IO_CORS=https://YOUR_FRONTEND_DOMAIN`

## Verify after deploy

1. Open frontend URL.
2. Register/login.
3. Add friend and open conversation.
4. Send text + image + video.
5. Confirm realtime updates and media playback.
