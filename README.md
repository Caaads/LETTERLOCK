# LetterLock

LetterLock is a browser-based word battle game with:

- Supabase authentication (Google login)
- Guest entry with custom username
- Multiplayer 1v1 room mode (Socket.IO)
- Bot mode with Easy, Medium, Hard difficulties

## Local Setup

1. Install dependencies:

```bash
npm install
```

2. Configure frontend Supabase keys in `app-config.js`:

```js
window.APP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

3. Start the app:

```bash
npm start
```

4. Open:

```text
http://localhost:3000
```

## Supabase Setup (Google OAuth)

1. Create a Supabase project.
2. Go to Authentication > Providers > Google and enable Google provider.
3. In Google Cloud Console, configure OAuth consent and credentials.
4. Add redirect URLs:
	- `http://localhost:3000`
	- your Railway production URL (example: `https://your-app.up.railway.app`)
5. Copy Supabase URL and anon key into `app-config.js`.

## Multiplayer Flow

1. User logs in with Google or enters guest username.
2. User enters room code and clicks Join Room.
3. Second user joins the same room code.
4. Both click Next Round to start each round.
5. Server validates submissions and returns winner + scores.

## Railway Deployment

This project is Railway-ready as a Node app.

1. Push this repository to GitHub.
2. In Railway, create a New Project from your repo.
3. Railway will detect `package.json` and run `npm start`.
4. Add environment variable if needed:
	- `PORT` (Railway usually sets this automatically)
5. Update Supabase redirect URL to your Railway domain.
6. Edit `app-config.js` in your deploy flow with your production Supabase values.

## Notes

- `app-config.js` currently ships with empty Supabase keys.
- If Supabase is not configured, users can still use Guest mode.
- Datamuse API is used for word validation/generation.
