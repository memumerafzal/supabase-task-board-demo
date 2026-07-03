# Supabase Task Board — Realtime Kanban Demo

> A realtime, multi-user Kanban board showcasing **Auth, Postgres + RLS, PostgREST,
> Realtime (Postgres Changes + Presence), Storage, RPC functions, and triggers** —
> all on a self-hosted Supabase stack.

![Stack](https://img.shields.io/badge/Supabase-self--hosted-3ECF8E)
![Frontend](https://img.shields.io/badge/Vite-vanilla_JS-646CFF)
![License](https://img.shields.io/badge/license-MIT-blue)

A small single-page app that runs entirely against a **local, self-hosted
Supabase** (the Docker stack in `../supabase/docker`). It exercises the core
Supabase building blocks in one place. See [`SUPABASE_FEATURES.md`](./SUPABASE_FEATURES.md)
for the feature-by-feature breakdown.

| Supabase feature | Where it's used |
| --- | --- |
| **Auth** | Login screen — email/password *or* one-click "Continue as guest" (anonymous). App is gated behind a session. |
| **Postgres + RLS** | `public.tasks` table; RLS lets any *authenticated* user read/write the shared board, blocks anonymous REST access. |
| **PostgREST API** | All CRUD via `supabase.from('tasks')…` |
| **Realtime — Postgres changes** | Task edits & the activity feed stream live to every open tab/user. |
| **Realtime — Presence** | Live avatars of everyone currently viewing the board. |
| **Storage** | Attach a file/image to a task (`task-files` bucket); shown on the card. |
| **Database functions** | A `task_stats()` SQL RPC powers the completion ring; a trigger writes the activity log. |

## What it does

- **Sign in** with email+password (auto-confirmed locally) or as an anonymous guest.
- **Add** tasks with a priority; each task records who created it.
- **Move** cards between **To&nbsp;Do → Doing → Done** by dragging (mouse or touch)
  or with the ‹ / › buttons.
- **Attach** a file to any task via the 📎 button — uploaded to Supabase Storage.
- **Delete** tasks.
- A live **Activity feed** (right side) shows created / moved / deleted events,
  written server-side by a Postgres trigger and streamed over Realtime.
- **Presence** avatars (top bar) show who else is on the board right now.
- A **completion ring** (top bar) is computed by the `task_stats()` Postgres RPC.

Everything is a **shared board**: open two tabs — or two accounts — and watch
tasks, presence, and the activity feed sync live.

## Run it

**Prerequisites:** a running self-hosted Supabase stack (Docker) reachable at
`http://localhost:8000`, plus Node 18+.

```bash
npm install
cp .env.example .env      # local Supabase URL + public demo anon key
npm run dev               # http://localhost:5173
```

Config lives in `.env` (`VITE_SUPABASE_URL` → the Kong gateway on `:8000`, plus
the local demo anon key). `.env.example` already contains working local values.

## Database & storage setup

All schema (tables, RLS policies, the trigger, the `task_stats` RPC, the
`task-files` storage bucket + policies, Realtime publication, and seed rows)
lives in [`schema.sql`](./schema.sql). Re-apply anytime with:

```bash
docker exec -i supabase-db psql -U postgres -d postgres < schema.sql
```

Browse the data in **Supabase Studio** at http://localhost:8000.

### Auth settings enabled for this demo

For a login flow that works without an email server, two GoTrue settings were
turned on in `../supabase/docker/.env` and the `auth` container restarted:

```
ENABLE_ANONYMOUS_USERS=true      # "Continue as guest"
ENABLE_EMAIL_AUTOCONFIRM=true    # email sign-up logs in immediately (no email link)
```

> ⚠️ These settings and the open "any authenticated user can edit everything"
> RLS policy are chosen to make the **local demo** frictionless. For production
> you'd disable autoconfirm/anonymous as appropriate and scope RLS per user
> (e.g. `created_by = auth.uid()`).
