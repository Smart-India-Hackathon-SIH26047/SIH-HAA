# Auth setup (Supabase)

Two things to do, both in the Supabase dashboard. Ten minutes.

## 1. Put the project keys in `frontend/.env`

**Project Settings → API**:

```
VITE_SUPABASE_URL=https://dlqwfewfbkjnvwhuqsdt.supabase.co
VITE_SUPABASE_ANON_KEY=<the anon / publishable key>
```

The URL is derived from the project ref in your `DATABASE_URL` — confirm it
matches what the dashboard shows.

Use the **anon / publishable** key. It is designed to ship in a browser bundle
and is safe there; Row Level Security is what protects the data. **Never** put
the `service_role` key in this app — it bypasses RLS entirely.

Restart the dev server after editing `.env` (Vite only reads it at startup).

While these are unset the app shows a setup notice instead of failing with an
opaque network error.

## 2. Create the `profiles` table

**SQL Editor → New query**, paste and run:

```sql
-- Which role each signed-in user chose, and which case record they map to.
create table if not exists public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  role         text not null check (role in ('victim', 'officer')),
  person_id    uuid references public.people(id)   on delete set null,
  officer_id   uuid references public.officers(id) on delete set null,
  display_name text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- A user can only ever see or change their own row.
create policy "profiles: read own"
  on public.profiles for select using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
```

That is the whole migration. Nothing in `people`, `officers`, `checkins`,
`scores`, `alerts` or `case_events` is touched, and no existing data moves.

### Optional: verify

```sql
select tablename, rowsecurity from pg_tables where tablename = 'profiles';
select policyname from pg_policies where tablename = 'profiles';
```

You should see `rowsecurity = true` and three policies.

## 3. Turn off email confirmation for a demo (optional)

**Authentication → Providers → Email → Confirm email = off.**

With it on, registering shows "check your email to confirm" and you cannot sign
in until you do — fine for production, awkward on a demo laptop.

---

## What this does and does not protect

Read this before demoing.

**It gates the UI, not the API.** The FastAPI backend has no authentication of
its own and does not verify Supabase tokens. Every endpoint — `/people`,
`/people/{id}/history`, `/officers/{id}/alerts` — is still reachable directly
with `curl`, signed in or not. The login screen stops someone using the *app*
without an account; it does not stop anyone reaching the *data*.

Closing that means verifying the Supabase JWT in FastAPI: read the `Authorization:
Bearer <token>` header, verify it against the project's JWKS, and reject
unauthenticated requests. That is a backend change and has not been made.

**Roles are self-selected.** The role picker lets any signed-in user choose "I'm
an officer" and see every person's district, distress score and band. For a
hackathon demo with seeded data that is a reasonable trade; for anything real it
is not. Options, cheapest first:

1. Drop the `profiles: update own` policy after seeding, and set officer roles by
   hand in the dashboard.
2. Require an invite code on the officer path, checked server-side.
3. Move `role` into `auth.users.app_metadata`, which only a service_role key can
   write, and read it from the JWT.

**Accounts are not yet linked to case records.** `profiles.person_id` and
`profiles.officer_id` exist but are populated from `VITE_DEMO_PERSON_ID` /
`VITE_DEMO_OFFICER_ID` on first role pick, so every victim account currently
maps to the same demo `Person`. Linking properly needs a decision about how a
real person is matched to their case — issued at registration by a case worker,
claimed with a case code, or assigned by an admin. That decision has not been
made, so nothing pretends to have made it.

To link an account by hand meanwhile:

```sql
update public.profiles
   set person_id = '<people.id>'
 where id = '<auth.users.id>';
```
