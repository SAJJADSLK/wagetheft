-- ================================================
-- WageTheft.live — Supabase Schema
-- Run in: Supabase Dashboard → SQL Editor → Run
-- ================================================

create table if not exists violations (
  id                 uuid    default gen_random_uuid() primary key,
  company_name       text    not null,
  trade_name         text,
  industry           text,
  violation_type     text,
  employees_affected integer default 0,
  amount_back_wages  numeric default 0,
  amount_penalties   numeric default 0,
  city               text,
  state_province     text,
  country            text    not null default 'USA',
  year               integer,
  case_id            text    unique,
  source_agency      text,
  source_url         text,
  created_at         timestamptz default now(),
  updated_at         timestamptz default now()
);

-- Full-text search index
create index if not exists violations_fts_idx
  on violations using gin(to_tsvector('english', company_name));

-- Performance indexes
create index if not exists violations_company_lower_idx on violations (lower(company_name));
create index if not exists violations_country_idx        on violations (country);
create index if not exists violations_year_idx           on violations (year desc nulls last);
create index if not exists violations_amount_idx         on violations (amount_back_wages desc);
create index if not exists violations_created_idx        on violations (created_at desc);

-- Cached homepage stats (updated by cron daily)
create table if not exists stats (
  id                     integer primary key default 1,
  total_violations       integer default 0,
  total_wages_stolen     numeric default 0,
  total_workers_affected integer default 0,
  last_updated           timestamptz default now()
);
insert into stats (id) values (1) on conflict do nothing;

-- Cron run log (for debugging)
create table if not exists cron_log (
  id         uuid default gen_random_uuid() primary key,
  source     text,
  records_in integer,
  status     text,
  error      text,
  ran_at     timestamptz default now()
);

-- Row Level Security
alter table violations enable row level security;
alter table stats       enable row level security;
alter table cron_log    enable row level security;

-- Public can read
create policy "public_read_violations" on violations for select using (true);
create policy "public_read_stats"      on stats       for select using (true);
create policy "public_read_cron_log"   on cron_log    for select using (true);

-- Only service_role can write
create policy "service_write_violations" on violations for insert
  with check (auth.role() = 'service_role');
create policy "service_update_violations" on violations for update
  using (auth.role() = 'service_role');
create policy "service_update_stats" on stats for update
  using (auth.role() = 'service_role');
create policy "service_insert_cron_log" on cron_log for insert
  with check (auth.role() = 'service_role');

-- ================================================
-- SCHEMA UPDATE — Add Europe support
-- Run this if you already ran the initial schema
-- ================================================

-- Country index already covers new countries (no change needed)
-- Just verify the country column has no enum constraint:
-- ALTER TABLE violations ALTER COLUMN country TYPE text; -- already text, no-op

-- Optional: create a view of violations by country for quick stats
create or replace view violations_by_country as
  select
    country,
    count(*)                           as total_violations,
    sum(amount_back_wages)             as total_wages_stolen,
    sum(employees_affected)            as total_workers,
    max(updated_at)                    as last_updated
  from violations
  group by country
  order by total_wages_stolen desc;
