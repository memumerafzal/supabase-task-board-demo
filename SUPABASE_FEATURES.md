# Supabase Features Used

Which Supabase features the Task Board app uses, **why**, and **where**.

| Feature | Why it's used | Where |
|---------|---------------|-------|
| **Auth** | Gate the app behind a login; support email/password and anonymous "guest" sign-in. | `src/auth.js` |
| **Postgres database** | Persist tasks and the activity log. | `schema.sql` (`tasks`, `activity_log`) |
| **Row Level Security (RLS)** | Let only logged-in users read/write the board; block anonymous access. | `schema.sql` (policies) |
| **PostgREST (auto REST API)** | Do all task CRUD without writing a backend. | `src/api.js` |
| **Realtime — Postgres Changes** | Sync task edits and the activity feed live across all tabs/users. | `src/board.js`, `src/activity.js` |
| **Realtime — Presence** | Show who is currently viewing the board (live avatars + count). | `src/presence.js` |
| **Storage** | Upload and display file/image attachments on tasks. | `src/api.js`, `src/board.js` (bucket `task-files`) |
| **Database Function (RPC)** | Compute board stats / completion % in the database. | `schema.sql` (`task_stats()`), `src/api.js` |
| **Database Trigger** | Log every create/move/delete server-side into the activity feed. | `schema.sql` (`log_task_activity()`) |
| **supabase-js client** | Single SDK for auth, database, realtime, and storage. | `src/supabaseClient.js` |
