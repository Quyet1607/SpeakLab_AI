-- SpeakLab AI / Phase 6.10.1: server-managed private recording metadata.
-- This SQL is a migration TEMPLATE. It is not executed by a Vercel deployment.
-- Contains NO student identities or Drive credentials.

create extension if not exists pgcrypto;

create table if not exists public.speaklab_recordings (
  id uuid primary key default gen_random_uuid(),
  owner_sub varchar(64) not null check (owner_sub ~ '^[0-9]{5,64}$'),
  session_id varchar(128) not null,
  title varchar(250) not null,
  mime_type varchar(80) not null check (mime_type in ('video/webm', 'video/mp4')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10737418240),
  drive_file_id varchar(256) unique,
  status varchar(16) not null default 'pending'
    check (status in ('pending', 'uploading', 'ready', 'failed', 'deleting')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ready_needs_drive_file check (status <> 'ready' or drive_file_id is not null)
);

create index if not exists speaklab_recordings_owner_created_idx
  on public.speaklab_recordings (owner_sub, created_at desc, id desc);

-- Supabase secret key -> service_role; browser-side roles get no access.
alter table public.speaklab_recordings enable row level security;
revoke all on table public.speaklab_recordings from public, anon, authenticated;
grant select, insert, update, delete on table public.speaklab_recordings to service_role;

-- No RLS policies for anon/authenticated. Never expose a secret key to a browser.
-- The API is the authorization boundary: verify signed Google session, then
-- WHERE owner_sub = server-verified Google subject on EVERY metadata operation.
-- Future upload and delete operations must use a transaction-safe state machine
-- and verify the Drive object corresponds to the owner's metadata row.
