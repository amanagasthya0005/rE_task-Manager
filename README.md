# Recovery Task Manager

A lightweight JIRA-inspired task manager built with plain HTML, CSS and JavaScript.

## Backend
Supabase is used for shared PostgreSQL storage, authentication, Row Level Security and Realtime synchronization.

### Current Supabase project
The project URL and publishable key are already configured in `js/config.js`.

**Never add a Supabase Secret/service_role key to this repository.**

## First-time Supabase setup
1. Run `supabase/schema.sql` in Supabase SQL Editor.
2. In Authentication → Users, create the editor account:
   - Email: `rE_Task@re-task.local`
   - Password: `rEisthebest`
   - Auto-confirm the user if prompted.
3. Host the project from GitHub Pages.

## Login
- Guest: read-only
- Editor:
  - Username: `rE_Task`
  - Password: `rEisthebest`

## Features
- BACKLOG → TODO → IN PROGRESS → IN REVIEW → DONE
- Drag/drop workflow
- Task creation, editing and deletion
- Assignees, priority, labels and due dates
- Comments and task history
- Team management
- Search, filters and sorting
- My Work, Backlog and Activity views
- Light/dark mode
- JSON backup import/export
- Supabase Realtime updates
- Local fallback if Supabase is unavailable
- No build step required

## GitHub Pages
Upload the contents of this folder to your repository and enable GitHub Pages from the repository's Settings → Pages. The app is static and does not require Node.js.

## Security note
The editor credentials in this prototype are intentionally simple. Supabase authentication and RLS protect database writes, but this is still an internal-tool prototype rather than a hardened public SaaS authentication system.
