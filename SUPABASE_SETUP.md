# Supabase setup — rE Task Manager

This project uses Supabase as the free backend: Postgres + Auth + Row Level Security + Realtime.

## 1. Create the project

Create a free Supabase project.

## 2. Create the database

Open **SQL Editor**, paste the contents of:

`supabase/schema.sql`

Run it once.

This creates:
- `tasks`
- `team_members`
- `activity`
- `comments`

It also enables RLS and read/write policies.

## 3. Create the editor account

In **Authentication → Users**, create a user with:

- Email: `rE_Task@re-task.local`
- Password: `rEisthebest`

For this prototype, disable email confirmation for the user/project so the account can sign in immediately.

The UI still asks for:

- Username: `rE_Task`
- Password: `rEisthebest`

The email is only the internal Supabase Auth identity.

## 4. Get the frontend keys

Open your project's **Connect** panel and copy:

- Project URL
- Publishable key

Paste them into:

`js/config.js`

Example:

```js
window.RE_CONFIG = {
  SUPABASE_URL: "https://your-project.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "your-publishable-key",
  EDITOR_AUTH_EMAIL: "rE_Task@re-task.local"
};
```

Only the publishable/anon client key belongs in the frontend. **Never put the `service_role` key in GitHub or browser code.**

## 5. GitHub Pages

Commit the entire project:

```text
index.html
assets/
css/
js/
supabase/
README.md
SUPABASE_SETUP.md
```

No npm install or build step is required.

Enable GitHub Pages for the repository.

## 6. How permissions work

Guest:
- No Supabase account required
- Reads shared tasks/team/activity/comments
- Cannot write

Editor:
- Signs in through Supabase Auth
- Can create/update/delete tasks
- Can move tasks
- Can manage team members
- Can add comments
- Can create activity/history

RLS is the actual security boundary; hiding editor buttons in JavaScript is not relied on for database security.

## 7. Live updates

Supabase Realtime is enabled for all four tables. If one browser changes a task, other open browsers can refresh their shared state automatically.

## 8. Local fallback

If `js/config.js` still contains placeholders, the application continues to work with its existing localStorage mode. Once valid Supabase credentials are added, Supabase becomes the shared source of truth.
