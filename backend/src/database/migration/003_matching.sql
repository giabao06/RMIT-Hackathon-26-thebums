-- Case lifecycle (M6), token lockdown (M5) and limited post-approval withdrawal (M8).
-- Run after 002_report_status.sql.

-- M5: no API role can read subject_token. Only the security-definer functions see it.
revoke all on cases from anon, authenticated, service_role;
grant select (id, org_id, status, eligible_at, created_at) on cases to service_role;
revoke all on reports from anon, authenticated;

alter table audit_log drop constraint audit_log_event_check;
alter table audit_log add constraint audit_log_event_check
  check (event in ('report_sealed','case_eligible','approval','released','closed','withdrawn','expired'));

-- M8: contact details live apart from the report so they can be removed alone.
alter table reports add column contact_ciphertext bytea;
alter table reports add column contact_removed boolean not null default false;

drop function submit_report(uuid, bytea, bytea, bytea, int);

create function submit_report(
  p_org uuid, p_token bytea, p_ciphertext bytea, p_withdraw_hash bytea,
  p_months int default null, p_contact bytea default null
) returns table (report_id uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid;
  v_report uuid;
  v_months int;
  v_expires timestamptz;
begin
  select retention_months into v_months from orgs where id = p_org;
  if not found then raise exception 'unknown org'; end if;
  v_months := least(18, greatest(12, coalesce(p_months, v_months)));
  v_expires := now() + make_interval(months => v_months);

  insert into cases (org_id, subject_token) values (p_org, p_token)
    on conflict (org_id, subject_token) do update set org_id = excluded.org_id
    returning id into v_case;

  insert into reports (org_id, case_id, ciphertext, contact_ciphertext, withdraw_hash, expires_at)
    values (p_org, v_case, p_ciphertext, p_contact, p_withdraw_hash, v_expires)
    returning id into v_report;

  insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'report_sealed');

  if (select count(*) from reports where case_id = v_case and status = 'sealed') >= 2 then
    update cases set status = 'eligible', eligible_at = now()
      where id = v_case and status = 'open';
    if found then
      insert into audit_log (org_id, case_id, event) values (p_org, v_case, 'case_eligible');
    end if;
  end if;

  return query select v_report, v_expires;
end $$;

-- Status now also sees released reports, so a reporter past release still gets 'locked'.
create or replace function get_report_status(p_report uuid, p_withdraw_hash bytea)
returns text
language sql security definer set search_path = public as $$
  select case c.status
           when 'open' then 'sealed'
           when 'eligible' then 'eligible'
           else 'locked'
         end
    from reports r join cases c on c.id = r.case_id
   where r.id = p_report and r.withdraw_hash = p_withdraw_hash and r.status in ('sealed','released');
$$;

-- After approval only the optional contact details can be removed.
-- Returns 'removed', 'none' (nothing to remove) or null (no such report/hash, or not locked).
create function withdraw_identity(p_report uuid, p_withdraw_hash bytea)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_case uuid;
  v_org uuid;
  v_had boolean;
begin
  select r.case_id, r.org_id, r.contact_ciphertext is not null
    into v_case, v_org, v_had
    from reports r join cases c on c.id = r.case_id
   where r.id = p_report and r.withdraw_hash = p_withdraw_hash
     and r.status in ('sealed','released') and c.status in ('approved','released');
  if not found then return null; end if;
  if not v_had then return 'none'; end if;

  update reports set contact_ciphertext = null, contact_removed = true where id = p_report;
  insert into audit_log (org_id, case_id, event) values (v_org, v_case, 'withdrawn');
  return 'removed';
end $$;

-- M6: open -> eligible (automatic) -> approved -> released -> closed.
-- Returns the new status, 'invalid' for a wrong-state jump, null for an unknown case.
-- The steward quorum is verified by Tide before the backend calls this; no decrypt happens here.
create function case_transition(p_case uuid, p_action text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_from text; v_to text; v_event text; v_org uuid;
begin
  select case p_action when 'approve' then 'eligible' when 'release' then 'approved'
                       when 'close' then 'released' end,
         case p_action when 'approve' then 'approved' when 'release' then 'released'
                       when 'close' then 'closed' end,
         case p_action when 'approve' then 'approval' when 'release' then 'released'
                       when 'close' then 'closed' end
    into v_from, v_to, v_event;
  if v_from is null then return 'invalid'; end if;

  select org_id into v_org from cases where id = p_case;
  if not found then return null; end if;

  update cases set status = v_to where id = p_case and status = v_from;
  if not found then return 'invalid'; end if;

  if v_to = 'released' then
    update reports set status = 'released' where case_id = p_case and status = 'sealed';
  end if;
  insert into audit_log (org_id, case_id, event) values (v_org, p_case, v_event);
  return v_to;
end $$;

-- Content-free overview: no token, no ciphertext.
create function list_cases()
returns table (id uuid, status text, report_count bigint, eligible_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.status,
         (select count(*) from reports r where r.case_id = c.id and r.status in ('sealed','released')),
         c.eligible_at
    from cases c order by c.created_at;
$$;

revoke execute on function submit_report, withdraw_identity, case_transition, list_cases from public;
grant execute on function submit_report, withdraw_identity to anon, authenticated;
grant execute on function case_transition, list_cases to service_role;
