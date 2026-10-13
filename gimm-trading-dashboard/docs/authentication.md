# Private dashboard access

The app supports one private account. `/` preserves bookmarked filters and redirects to `/dashboard`. Unauthenticated requests go to `/login`; authenticated requests load the dashboard. A Next.js proxy rejects invalid sessions before loading UI can stream, and the page checks the session again before database queries run. There is no public registration or default password.

## Configure your account

Use Node.js 22.18+ and install dependencies with `npm ci`.

1. Run `npm run auth:hash` in a terminal. Enter and confirm a unique password of at least 12 characters. Input is hidden; the command prints only the salted scrypt hash.
2. Generate a session secret locally with `openssl rand -hex 32`.
3. Set the following variables in your existing server environment. For Docker Compose, add them to your own `.env`. For local Next.js development, use `.env.local`. Keep these files private.

```dotenv
AUTH_USERNAME=your-private-username
AUTH_PASSWORD_HASH='paste-the-complete-scrypt-hash-here'
AUTH_SECRET=paste-your-generated-secret-here
```

Keep the **single quotes around the hash** in a Compose `.env`: the hash contains `$` characters. Never put these values in `NEXT_PUBLIC_*` variables. The app stays locked if any setting is missing or malformed. Secrets are runtime settings and are not required to build the application.

`npm run dev` serves the app locally. Open `/login` and use your configured account. Production cookies require HTTPS; the existing Caddy HTTPS reverse proxy remains compatible. Compose passes auth settings to the web container. Existing Caddy Basic Auth remains an additional prompt if enabled; the application login works independently.

## Session behavior

- Cookies are signed, HttpOnly, SameSite=Lax and Secure in production; they expire after ten years. Password or session-secret rotation invalidates existing sessions.
- Logout clears the browser cookie. Stateless sessions do not have a per-session server revocation list: a copied cookie remains valid until expiry. Rotating `AUTH_SECRET`, the username or password hash invalidates all current sessions.
- Login allows ten attempts per 15-minute window for the entire web process, including successful logins. This intentionally bounds work for the single-user deployment. Restarting the process resets the limit; before scaling to multiple web replicas, use a shared limiter. Other clients can exhaust the shared bucket temporarily.
- Login and logout use Next.js Server Actions with the framework's same-origin protection. Authorization is checked on the dashboard page itself, before data access, in addition to the early request guard. See the [Next.js proxy reference](https://nextjs.org/docs/app/api-reference/file-conventions/proxy). See the [Next.js authentication guide](https://nextjs.org/docs/app/guides/authentication).
- `/api/health` is intentionally available without a session and returns only readiness status, never trades or database error details.

## Verification without production access

```sh
npm run typecheck
npm test
npm run build
npm run test:smoke
```

The production build uses Webpack because Turbopack's CSS pipeline requires an internal listening socket that restricted build environments may deny. The output remains a Next.js standalone production application.

The smoke test copies the standalone output into a temporary directory, excludes `.env*`, launches a local server with generated test credentials and an unreachable database on `127.0.0.1:1`, and removes only its own temporary directory afterward. It checks login, logout, cookie flags, safe redirects, missing configuration, CSRF protection, rate limits and the database-unavailable view. It requires permission to listen on a local port. It never starts the sync worker, contacts Notion, or writes database data.

Docker uses `npm ci` with the committed lockfile, excludes `.env*` from image layers and preserves the existing database volume and external Caddy network. Web database connections default to read-only sessions; worker sessions remain writable. For stronger isolation, provision a separate PostgreSQL role with SELECT privileges for the web service in a separately reviewed infrastructure change.
