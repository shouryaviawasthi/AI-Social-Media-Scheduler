# LocalStorage to MongoDB Migration

This migration preserves browser localStorage and does not delete MongoDB data. Fake local social accounts are skipped.

## 1. Export browser data

Start the client and open the application in the browser. Open DevTools on the same origin and run:

```js
fetch('/export-local-data.js').then((response) => response.text()).then((script) => eval(script))
```

This downloads `scheduler-local-data.json` containing:

- `scheduler_users`
- every `scheduler_data_<userId>` key

It does not export `scheduler_current_user` and does not modify localStorage.

## 2. Run the migration

Place the downloaded JSON file where the server can read it, then run:

```powershell
cd server
npm run migrate:local -- ..\scheduler-local-data.json
```

The script is idempotent by legacy user, post, and activity IDs. It hashes passwords with bcrypt and never writes the old plaintext password to MongoDB. It skips all local `accounts` records.

## 3. Collections

The migration writes to:

- `portalusers`
- `posts`
- `activities`

The existing `sessions` and `socialaccounts` collections remain available. Fake local accounts are never inserted into `socialaccounts`.

## 4. Verification in MongoDB Compass

Connect to the configured MongoDB URI and select database `shouryaviawasthi598_db`.

Check that:

1. `portalusers` contains the migrated names and emails.
2. Each user has `passwordHash` beginning with a bcrypt prefix such as `$2b$` and no plaintext password field.
3. `posts` contains the expected user-owned posts.
4. `activities` contains the expected user-owned activities.
5. Scheduled posts retain `scheduledFor`, `status`, and `platforms`.
6. `socialaccounts` has no fake local accounts.

## 5. Run the application

In one terminal:

```powershell
cd server
npm start
```

In another terminal:

```powershell
cd client
npm run dev
```

Login now uses the MongoDB-backed authentication/session routes. Dashboard, Scheduler, and AI Composer read and write posts and activities through authenticated APIs. Clearing localStorage does not remove MongoDB records, although the browser will need to authenticate again if its session cookie is also absent or expired.

This phase does not implement OAuth, social publishing, or a server-side scheduler worker.
