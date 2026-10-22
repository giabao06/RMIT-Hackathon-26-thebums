-- SafeThreshold initial schema. Run in the Supabase SQL editor.
-- No table links a report to a person: no reporter id, no IP.

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  retention_months int not null default 12 check (retention_months between 12 and 18),
  quorum_m int not null default 2,
  quorum_n int not null default 3,
  check (quorum_m <= quorum_n)
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  subject_token bytea not null,  -- blinded token; never expose to clients
  status text not null default 'open'
    check (status in ('open','eligible','approved','released','closed')),
  eligible_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, subject_token)
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  case_id uuid not null references cases(id) on delete cascade,
  ciphertext bytea not null,     -- encrypted on the client via TideCloak
  withdraw_hash bytea not null,  -- hash of the receipt secret only the reporter holds
  status text not null default 'sealed'
    check (status in ('sealed','released','withdrawn','expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index on reports (case_id);
create index on reports (expires_at);

create table stewards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  tide_user_id text not null,
  display_name text not null,
  body text not null check (body in ('union','ngo','oversight')),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  rotated_out_at timestamptz
);

-- Mirror of the Tide quorum for audit only; Tide nodes enforce the real quorum.
create table approvals (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  steward_id uuid not null references stewards(id),
  decision text not null check (decision in ('approve','reject')),
  tide_signature text not null,
  created_at timestamptz not null default now(),
  unique (case_id, steward_id)
);

create table investigators (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  tide_user_id text not null,
  name text not null,
  active boolean not null default true
);

create table case_assignments (
  case_id uuid not null references cases(id) on delete cascade,
  investigator_id uuid not null references investigators(id),
  assigned_at timestamptz not null default now(),
  primary key (case_id, investigator_id)
);

-- Public, content-free audit log.
create table audit_log (
  id bigserial primary key,
  org_id uuid not null references orgs(id),
  case_id uuid,
  event text not null
    check (event in ('report_sealed','case_eligible','approval','released','withdrawn','expired')),
  prev_hash bytea,
  hash bytea,
  created_at timestamptz not null default now()
);

-- Row level security: on with no policies = denied for anon/authenticated.
-- Only the service role and the security-definer functions below touch data.
alter table orgs enable row level security;
alter table cases enable row level security;
alter table reports enable row level security;
alter table stewards enable row level security;
alter table approvals enable row level security;
alter table investigators enable row level security;
alter table case_assignments enable row level security;
alter table audit_log enable row level security;

-- Public read of the audit log (no content in it).
create policy "audit is public" on audit_log for select using (true);

-- Anonymous submit: upserts the case, inserts the report, flips to eligible at 2+.
create function submit_report(
  p_org uuid, p_token bytea, p_ciphertext bytea, p_withdraw_hash bytea
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid;
  v_report uuid;
  v_months int;
begin
  select retention_months into v_months from orgs where id = p_org;
  if not found then raise exception 'unknown org'; end if;

  insert into cases (org_id, subject_token) values (p_org, p_token)
    on conflict (org_id, subject_token) do update set org_id = excluded.org_id
    returning id into v_case;

  insert into reports (org_id, case_id, ciphertext, withdraw_hash, expires_at)
    values (p_org, v_case, p_ciphertext, p_withdraw_hash,
            now() + make_interval(months => v_months))
    returning id into v_report;

  insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'report_sealed');

  if (select count(*) from reports where case_id = v_case and status = 'sealed') >= 2 then
    update cases set status = 'eligible', eligible_at = now()
      where id = v_case and status = 'open';
    if found then
      insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'case_eligible');
    end if;
  end if;

  return v_report;
end $$;

-- Anonymous withdraw: only before the case is approved/released.
create function withdraw_report(p_report uuid, p_withdraw_hash bytea)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid;
  v_org uuid;
begin
  delete from reports r using cases c
    where r.id = p_report and r.withdraw_hash = p_withdraw_hash
      and r.status = 'sealed' and c.id = r.case_id and c.status in ('open','eligible')
    returning r.case_id, r.org_id into v_case, v_org;
  if not found then return false; end if;

  if (select count(*) from reports where case_id = v_case and status = 'sealed') < 2 then
    update cases set status = 'open', eligible_at = null
      where id = v_case and status = 'eligible';
  end if;
  insert into audit_log (org_id, case_id, event) values (v_org, v_case, 'withdrawn');
  return true;
end $$;

-- Expiry: call from pg_cron (enable the extension first), e.g.
--   select cron.schedule('expire-reports', '0 3 * * *', 'select expire_reports()');
create function expire_reports() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with gone as (
    delete from reports r using cases c
      where r.expires_at < now() and r.status = 'sealed'
        and c.id = r.case_id and c.status in ('open','eligible')
      returning r.case_id, r.org_id
  ), logged as (
    insert into audit_log (org_id, case_id, event)
      select org_id, case_id, 'expired' from gone
  )
  select count(*) into n from gone;
  delete from cases c where c.status = 'open'
    and not exists (select 1 from reports r where r.case_id = c.id);
  return n;
end $$;

revoke execute on function submit_report, withdraw_report, expire_reports from public;
grant execute on function submit_report, withdraw_report to anon, authenticated;
