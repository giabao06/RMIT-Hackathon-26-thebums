-- Steward-held Shamir shares (replaces TideCloak). Run after 007_audit.sql in the Supabase SQL editor.
--
-- The reporter's browser encrypts a report with a fresh key, splits that key with Shamir
-- (quorum_m of one share per active steward) and wraps each share to that steward's public key.
-- The database stores ciphertext and wrapped shares only: nothing here can decrypt anything.
-- To release a case, each steward unwraps their shares on their own device and re-wraps them to the
-- assigned investigator's public key; at quorum_m approvals the case is released.
--
-- Note: the columns/params named tide_user_id / p_tide_user now hold the Supabase Auth user id (uuid
-- as text). They keep their names so the earlier migrations' functions stay valid.

alter table stewards add column public_key bytea, add column key_backup bytea;
alter table investigators add column public_key bytea, add column key_backup bytea;
alter table approvals drop column tide_signature;

-- One share of a report's key per steward, wrapped to that steward's public key.
create table report_shares (
  report_id uuid not null references reports(id) on delete cascade,
  steward_id uuid not null references stewards(id),
  wrapped_share bytea not null,
  primary key (report_id, steward_id)
);

-- A steward's share re-wrapped to the investigator assigned to the case.
create table released_shares (
  report_id uuid not null references reports(id) on delete cascade,
  steward_id uuid not null references stewards(id),
  investigator_id uuid not null references investigators(id),
  wrapped_share bytea not null,
  primary key (report_id, steward_id)
);

alter table report_shares enable row level security;
alter table released_shares enable row level security;
revoke all on report_shares, released_shares from anon, authenticated;

-- Public keys and the threshold a reporter needs to seal. Public keys are not secret.
create function steward_keys(p_org uuid)
returns table (id uuid, public_key bytea, quorum_m int)
language sql security definer set search_path = public as $$
  select s.id, s.public_key, o.quorum_m
    from stewards s join orgs o on o.id = s.org_id
   where s.org_id = p_org and s.active and s.public_key is not null
   order by s.joined_at;
$$;

-- Enrols or replaces the caller's key. p_role is 'steward' or 'investigator'. False if the caller has no such active role.
create function enrol_key(p_user text, p_role text, p_public bytea, p_backup bytea)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if p_role = 'steward' then
    update stewards set public_key = p_public, key_backup = p_backup where tide_user_id = p_user and active;
  elsif p_role = 'investigator' then
    update investigators set public_key = p_public, key_backup = p_backup where tide_user_id = p_user and active;
  else
    return false;
  end if;
  return found;
end $$;

-- The caller's own key material (public key and passphrase-wrapped backup), for restoring on a new device.
create function my_key(p_user text, p_role text)
returns table (public_key bytea, key_backup bytea)
language sql security definer set search_path = public as $$
  select s.public_key, s.key_backup from stewards s where p_role = 'steward' and s.tide_user_id = p_user and s.active
  union all
  select i.public_key, i.key_backup from investigators i where p_role = 'investigator' and i.tide_user_id = p_user and i.active;
$$;

-- Sealing now carries the wrapped shares: p_shares = [{"steward": uuid, "share": hex}], exactly one per active
-- steward that has a key, and every active steward must have one.
drop function submit_report(uuid, bytea, bytea, bytea, int, bytea);

create function submit_report(
  p_org uuid, p_token bytea, p_ciphertext bytea, p_withdraw_hash bytea,
  p_months int, p_contact bytea, p_shares jsonb
) returns table (report_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid;
  v_report uuid;
  v_months int;
  v_expires timestamptz;
  v_keyed int;
  v_active int;
begin
  select retention_months into v_months from orgs where id = p_org;
  if not found then raise exception 'unknown org'; end if;

  select count(*) filter (where public_key is not null), count(*) into v_keyed, v_active
    from stewards where org_id = p_org and active;
  if v_active < 3 or v_keyed <> v_active then raise exception 'stewards are not set up'; end if;
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) <> v_active
     or (select count(distinct e->>'steward') from jsonb_array_elements(p_shares) e) <> v_active
     or exists (
       select 1 from jsonb_array_elements(p_shares) e
        where not exists (select 1 from stewards s where s.id = (e->>'steward')::uuid and s.org_id = p_org and s.active)
           or coalesce(e->>'share', '') !~ '^[0-9a-f]+$') then
    raise exception 'bad shares';
  end if;

  v_months := least(18, greatest(12, coalesce(p_months, v_months)));
  v_expires := now() + make_interval(months => v_months);

  insert into cases (org_id, subject_token) values (p_org, p_token)
    on conflict (org_id, subject_token) do update set org_id = excluded.org_id
    returning id into v_case;

  insert into reports (org_id, case_id, ciphertext, contact_ciphertext, withdraw_hash, expires_at)
    values (p_org, v_case, p_ciphertext, p_contact, p_withdraw_hash, v_expires)
    returning id into v_report;

  insert into report_shares (report_id, steward_id, wrapped_share)
    select v_report, (e->>'steward')::uuid, decode(e->>'share', 'hex') from jsonb_array_elements(p_shares) e;

  insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'report_sealed');

  if (select count(*) from reports r where r.case_id = v_case and r.status = 'sealed') >= 2 then
    update cases set status = 'eligible', eligible_at = now()
      where id = v_case and status = 'open';
    if found then
      insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'case_eligible');
    end if;
  end if;

  return query select v_report, v_expires;
end $$;

-- Cases are assigned an investigator while eligible, before the stewards approve. One investigator per case.
create or replace function assign_investigator(p_case uuid, p_tide_user text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_status text; v_inv uuid;
begin
  select org_id, status into v_org, v_status from cases where id = p_case;
  if not found then return null; end if;

  select id into v_inv from investigators
   where tide_user_id = p_tide_user and org_id = v_org and active and public_key is not null;
  if not found then return null; end if;

  if v_status <> 'eligible' or exists (select 1 from case_assignments where case_id = p_case) then return 'invalid'; end if;

  insert into case_assignments (case_id, investigator_id) values (p_case, v_inv);
  return 'assigned';
end $$;

create or replace function admin_assign(p_tide_user text, p_case uuid, p_investigator uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_status text;
begin
  select org_id, status into v_org, v_status from cases where id = p_case;
  if not found then return null; end if;
  if not exists (select 1 from org_admins where tide_user_id = p_tide_user and org_id = v_org and active) then return null; end if;
  if v_status <> 'eligible'
     or exists (select 1 from case_assignments where case_id = p_case)
     or not exists (select 1 from investigators where id = p_investigator and org_id = v_org and active and public_key is not null) then
    return 'invalid';
  end if;
  insert into case_assignments (case_id, investigator_id) values (p_case, p_investigator);
  insert into audit_log (org_id, case_id, event) values (v_org, p_case, 'investigator_assigned');
  return 'assigned';
end $$;

-- Steward view: content-free. 'assigned' says whether an investigator is chosen yet (approval needs one).
drop function steward_cases(text);
create function steward_cases(p_tide_user text)
returns table (id uuid, status text, report_count bigint, eligible_at timestamptz,
               approvals bigint, quorum_m int, quorum_n int, mine boolean, assigned boolean)
language sql security definer set search_path = public as $$
  select c.id, c.status,
         (select count(*) from reports r where r.case_id = c.id and r.status in ('sealed','released')),
         c.eligible_at,
         (select count(*) from approvals a where a.case_id = c.id and a.decision = 'approve'),
         o.quorum_m, o.quorum_n,
         exists (select 1 from approvals a where a.case_id = c.id and a.steward_id = s.id),
         exists (select 1 from case_assignments x where x.case_id = c.id)
    from stewards s
    join cases c on c.org_id = s.org_id and c.status in ('eligible','released')
    join orgs o on o.id = c.org_id
   where s.tide_user_id = p_tide_user and s.active
   order by c.eligible_at;
$$;

-- This steward's wrapped shares for an eligible, assigned case, plus the investigator's public key to re-wrap to.
create function steward_shares(p_tide_user text, p_case uuid)
returns table (report_id uuid, wrapped_share bytea, investigator_public_key bytea, steward_id uuid)
language sql security definer set search_path = public as $$
  select r.id, rs.wrapped_share, i.public_key, s.id
    from stewards s
    join cases c on c.org_id = s.org_id and c.id = p_case and c.status = 'eligible'
    join case_assignments a on a.case_id = c.id
    join investigators i on i.id = a.investigator_id
    join reports r on r.case_id = c.id and r.status = 'sealed'
    join report_shares rs on rs.report_id = r.id and rs.steward_id = s.id
   where s.tide_user_id = p_tide_user and s.active
   order by r.created_at;
$$;

-- Records one approval together with the steward's re-wrapped shares: p_shares = [{"report": uuid, "share": hex}],
-- exactly one per sealed report of the case. Returns the case status after it, 'invalid' (wrong state, no investigator,
-- or the shares do not match the case), or null if the caller is not an active steward of the case's org.
drop function steward_approve(text, uuid, text);
create function steward_approve(p_tide_user text, p_case uuid, p_shares jsonb)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_steward uuid; v_org uuid; v_status text; v_m int; v_count int; v_inv uuid; v_reports int;
begin
  select c.org_id, c.status, o.quorum_m into v_org, v_status, v_m
    from cases c join orgs o on o.id = c.org_id where c.id = p_case;
  if not found then return null; end if;

  select id into v_steward from stewards
   where tide_user_id = p_tide_user and org_id = v_org and active;
  if not found then return null; end if;

  select investigator_id into v_inv from case_assignments where case_id = p_case;
  if v_status <> 'eligible' or v_inv is null then return 'invalid'; end if;

  select count(*) into v_reports from reports where case_id = p_case and status = 'sealed';
  if jsonb_typeof(p_shares) <> 'array' or jsonb_array_length(p_shares) <> v_reports
     or (select count(distinct e->>'report') from jsonb_array_elements(p_shares) e) <> v_reports
     or exists (
       select 1 from jsonb_array_elements(p_shares) e
        where not exists (select 1 from reports r where r.id = (e->>'report')::uuid and r.case_id = p_case and r.status = 'sealed')
           or coalesce(e->>'share', '') !~ '^[0-9a-f]+$') then
    return 'invalid';
  end if;

  insert into approvals (case_id, steward_id, decision) values (p_case, v_steward, 'approve')
    on conflict (case_id, steward_id) do nothing;
  if not found then return v_status; end if; -- already approved: no second audit entry or share set

  insert into released_shares (report_id, steward_id, investigator_id, wrapped_share)
    select (e->>'report')::uuid, v_steward, v_inv, decode(e->>'share', 'hex') from jsonb_array_elements(p_shares) e;
  insert into audit_log (org_id, case_id, event) values (v_org, p_case, 'approval');

  select count(*) into v_count from approvals where case_id = p_case and decision = 'approve';
  if v_count >= v_m then
    update cases set status = 'released' where id = p_case and status = 'eligible';
    update reports set status = 'released' where case_id = p_case and status = 'sealed';
    insert into audit_log (org_id, case_id, event) values (v_org, p_case, 'released');
    return 'released';
  end if;
  return v_status;
end $$;

-- The re-wrapped shares of a released case, for its assigned investigator only.
create function investigator_shares(p_tide_user text, p_case uuid)
returns table (report_id uuid, steward_id uuid, wrapped_share bytea)
language sql security definer set search_path = public as $$
  select x.report_id, x.steward_id, x.wrapped_share
    from investigators i
    join case_assignments a on a.investigator_id = i.id and a.case_id = p_case
    join cases c on c.id = a.case_id and c.status = 'released'
    join released_shares x on x.investigator_id = i.id
    join reports r on r.id = x.report_id and r.case_id = c.id
   where i.tide_user_id = p_tide_user and i.active;
$$;

revoke execute on function steward_keys, enrol_key, my_key, steward_shares, investigator_shares, steward_approve, steward_cases from public;
grant execute on function steward_keys, enrol_key, my_key, steward_shares, investigator_shares, steward_approve, steward_cases to service_role;
revoke execute on function submit_report from public;
grant execute on function submit_report to anon, authenticated;

-- Server-side role check for the Supabase Auth user id. A role is an active row, never a token claim.
create function has_role(p_user text, p_role text) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_role
    when 'steward' then exists (select 1 from stewards where tide_user_id = p_user and active)
    when 'investigator' then exists (select 1 from investigators where tide_user_id = p_user and active)
    when 'org-admin' then exists (select 1 from org_admins where tide_user_id = p_user and active)
    else false end;
$$;
revoke execute on function has_role from public;
grant execute on function has_role to service_role;
