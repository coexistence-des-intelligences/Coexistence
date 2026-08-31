-- Coexistence des intelligences — schéma initial V0.1
-- À exécuter une seule fois dans Supabase > SQL Editor.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists vector with schema extensions;

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  instance_id text not null,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  title text not null,
  summary text not null,
  nature jsonb not null default '[]'::jsonb,
  open_question text not null default '',
  conversation jsonb,
  status text not null default 'pending_analysis' check (status in ('pending_analysis','published','quarantined','processing_error','withdrawn')),
  publication_note text,
  consent_version text not null default '0.1',
  embedding extensions.vector(1536)
);

create index if not exists contributions_status_created_idx on public.contributions(status, created_at desc);
create index if not exists contributions_embedding_idx on public.contributions using hnsw (embedding vector_cosine_ops);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text not null,
  protocol_version text not null,
  content jsonb not null,
  supersedes uuid references public.analyses(id),
  status text not null default 'active' check (status in ('active','superseded','withdrawn'))
);
create index if not exists analyses_contribution_idx on public.analyses(contribution_id, created_at desc);

create table if not exists public.themes (
  id uuid primary key default gen_random_uuid(),
  canonical_key text unique not null,
  label text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.contribution_themes (
  contribution_id uuid not null references public.contributions(id) on delete cascade,
  theme_id uuid not null references public.themes(id) on delete cascade,
  confidence double precision not null default 0.5,
  created_at timestamptz not null default now(),
  primary key (contribution_id, theme_id)
);

create table if not exists public.contribution_relations (
  id uuid primary key default gen_random_uuid(),
  source_contribution_id uuid not null references public.contributions(id) on delete cascade,
  target_contribution_id uuid not null references public.contributions(id) on delete cascade,
  relation_type text not null check (relation_type in ('supports','contradicts','extends','similar','different_frame')),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique(source_contribution_id, target_contribution_id, relation_type)
);

create table if not exists public.disagreements (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  canonical_key text unique not null,
  title text not null,
  summary text not null,
  positions jsonb not null default '[]'::jsonb,
  evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','partially_resolved','resolved','branched','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.risks (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  canonical_key text unique not null,
  title text not null,
  summary text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','watching','mitigated','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  canonical_key text unique not null,
  question text not null,
  evidence_ids jsonb not null default '[]'::jsonb,
  status text not null default 'open' check (status in ('open','exploring','answered','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.proposals (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  canonical_key text unique not null,
  proposal_type text not null check (proposal_type in ('methodology','charter','technical','governance','other','version_candidate')),
  title text not null,
  summary text not null,
  counterargument text,
  evidence_ids jsonb not null default '[]'::jsonb,
  payload jsonb,
  status text not null default 'open' check (status in ('open','under_contradiction','experimental','adopted','rejected','branched','archived')),
  source text not null default 'unknown',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collective_syntheses (
  id uuid primary key default gen_random_uuid(),
  public_id text unique not null,
  created_at timestamptz not null default now(),
  model text not null,
  protocol_version text not null,
  content jsonb not null
);

create table if not exists public.events (
  id bigserial primary key,
  public_id text unique not null,
  instance_id text not null,
  created_at timestamptz not null default now(),
  event_type text not null,
  public_summary text not null,
  details jsonb not null default '{}'::jsonb,
  visibility text not null default 'public' check (visibility in ('public','internal'))
);
create index if not exists events_created_idx on public.events(created_at desc);

create table if not exists public.rate_limits (
  subject_hash text not null,
  action text not null,
  window_started_at timestamptz not null,
  counter integer not null default 0,
  primary key(subject_hash, action)
);

create table if not exists public.federated_instances (
  id uuid primary key default gen_random_uuid(),
  instance_id text unique not null,
  base_url text not null,
  protocol_version text not null,
  trust_status text not null default 'unverified' check (trust_status in ('unverified','observed','trusted','blocked')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create table if not exists public.federated_events (
  id uuid primary key default gen_random_uuid(),
  origin_instance_id text not null,
  origin_event_id text not null,
  payload jsonb not null,
  verification_status text not null default 'unverified' check (verification_status in ('unverified','verified','rejected')),
  received_at timestamptz not null default now(),
  unique(origin_instance_id, origin_event_id)
);

-- Les clés publiques restent stables lors d'un upsert par canonical_key.
create or replace function public.preserve_public_id() returns trigger
language plpgsql as $$
begin
  if tg_op = 'UPDATE' and old.public_id is not null then
    new.public_id := old.public_id;
  end if;
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['disagreements','risks','questions','proposals'] loop
    execute format('drop trigger if exists preserve_public_id_trigger on public.%I', t);
    execute format('create trigger preserve_public_id_trigger before update on public.%I for each row execute function public.preserve_public_id()', t);
  end loop;
end $$;

-- Limitation de débit avec identifiant pseudonyme HMAC créé côté Worker.
create or replace function public.check_rate_limit(
  p_subject_hash text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
) returns table(allowed boolean, remaining integer, resets_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  r public.rate_limits%rowtype;
  now_ts timestamptz := now();
begin
  insert into public.rate_limits(subject_hash, action, window_started_at, counter)
  values (p_subject_hash, p_action, now_ts, 1)
  on conflict(subject_hash, action) do update set
    window_started_at = case
      when public.rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now_ts then now_ts
      else public.rate_limits.window_started_at end,
    counter = case
      when public.rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= now_ts then 1
      else public.rate_limits.counter + 1 end
  returning * into r;

  allowed := r.counter <= p_limit;
  remaining := greatest(0, p_limit - r.counter);
  resets_at := r.window_started_at + make_interval(secs => p_window_seconds);
  return next;
end;
$$;

create or replace function public.match_contributions(
  query_embedding text,
  match_count integer default 8,
  exclude_id uuid default null
) returns table(public_id text, title text, summary text, similarity double precision)
language sql stable security definer set search_path = public, extensions as $$
  select c.public_id, c.title, c.summary,
         1 - (c.embedding <=> query_embedding::extensions.vector) as similarity
  from public.contributions c
  where c.status = 'published'
    and c.embedding is not null
    and (exclude_id is null or c.id <> exclude_id)
  order by c.embedding <=> query_embedding::extensions.vector
  limit greatest(1, least(match_count, 20));
$$;

-- Aucune table n'est accessible directement au navigateur dans V0.1.
-- Le Worker serveur utilise service_role ; le public passe uniquement par les routes /api/public/*.
alter table public.contributions enable row level security;
alter table public.analyses enable row level security;
alter table public.themes enable row level security;
alter table public.contribution_themes enable row level security;
alter table public.contribution_relations enable row level security;
alter table public.disagreements enable row level security;
alter table public.risks enable row level security;
alter table public.questions enable row level security;
alter table public.proposals enable row level security;
alter table public.collective_syntheses enable row level security;
alter table public.events enable row level security;
alter table public.rate_limits enable row level security;
alter table public.federated_instances enable row level security;
alter table public.federated_events enable row level security;

-- Nettoyage périodique possible pour les pseudo-identifiants de rate-limit.
-- Exemple à lancer via pg_cron plus tard : delete from rate_limits where window_started_at < now() - interval '2 days';
