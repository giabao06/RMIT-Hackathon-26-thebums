-- Reporter status check and per-report lifespan. Run after 001_init.sql.

-- Replaces submit_report with a version that takes the reporter's chosen lifespan (12-18 months).
drop function submit_report(uuid, bytea, bytea, bytea);

create function submit_report(
  p_org uuid, p_token bytea, p_ciphertext bytea, p_withdraw_hash bytea, p_months int default null
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

  insert into reports (org_id, case_id, ciphertext, withdraw_hash, expires_at)
    values (p_org, v_case, p_ciphertext, p_withdraw_hash, v_expires)
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

-- Receipt holder's view: 'sealed' | 'eligible' | 'locked' (approved or released), null if the
-- id/hash pair matches nothing. Never says who else reported.
create function get_report_status(p_report uuid, p_withdraw_hash bytea)
returns text
language sql security definer set search_path = public as $$
  select case c.status
           when 'open' then 'sealed'
           when 'eligible' then 'eligible'
           else 'locked'
         end
    from reports r join cases c on c.id = r.case_id
   where r.id = p_report and r.withdraw_hash = p_withdraw_hash and r.status = 'sealed';
$$;

revoke execute on function submit_report, get_report_status from public;
grant execute on function submit_report, get_report_status to anon, authenticated;
