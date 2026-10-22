-- Investigator access. Run after 004_steward.sql.
-- The investigator receives ciphertext only; decryption happens on their device through Tide.

-- Returns 'assigned', 'invalid' if the case is not released, or null if the case is unknown or
-- the investigator is not an active investigator of the case's org.
create function assign_investigator(p_case uuid, p_tide_user text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_status text; v_inv uuid;
begin
  select org_id, status into v_org, v_status from cases where id = p_case;
  if not found then return null; end if;

  select id into v_inv from investigators
   where tide_user_id = p_tide_user and org_id = v_org and active;
  if not found then return null; end if;

  if v_status <> 'released' then return 'invalid'; end if;

  insert into case_assignments (case_id, investigator_id) values (p_case, v_inv)
    on conflict do nothing;
  return 'assigned';
end $$;

-- Content-free: released cases assigned to this active investigator.
create function investigator_cases(p_tide_user text)
returns table (id uuid, status text, report_count bigint, eligible_at timestamptz)
language sql security definer set search_path = public as $$
  select c.id, c.status,
         (select count(*) from reports r where r.case_id = c.id and r.status = 'released'),
         c.eligible_at
    from investigators i
    join case_assignments a on a.investigator_id = i.id
    join cases c on c.id = a.case_id and c.status = 'released'
   where i.tide_user_id = p_tide_user and i.active
   order by c.eligible_at;
$$;

-- Ciphertext of a released case's reports. Empty unless the caller is assigned to it.
-- Never returns subject_token or withdraw_hash.
create function investigator_reports(p_tide_user text, p_case uuid)
returns table (id uuid, created_at timestamptz, ciphertext bytea, contact_ciphertext bytea)
language sql security definer set search_path = public as $$
  select r.id, r.created_at, r.ciphertext, r.contact_ciphertext
    from investigators i
    join case_assignments a on a.investigator_id = i.id and a.case_id = p_case
    join cases c on c.id = a.case_id and c.status = 'released'
    join reports r on r.case_id = c.id and r.status = 'released'
   where i.tide_user_id = p_tide_user and i.active
   order by r.created_at;
$$;

revoke execute on function assign_investigator, investigator_cases, investigator_reports from public;
grant execute on function assign_investigator, investigator_cases, investigator_reports to service_role;
