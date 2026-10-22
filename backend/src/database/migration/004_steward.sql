-- Steward decisions (quorum mirror). Run after 003_matching.sql.
-- Tide nodes enforce the real release quorum; this records approvals for audit and moves the
-- case to 'approved' once quorum_m stewards have approved. A steward who never approves just
-- leaves the case waiting: nothing here can sign for them or time them out.

-- Content-free: no token, no ciphertext, no reporter data. Empty unless the caller is an active steward.
create function steward_cases(p_tide_user text)
returns table (id uuid, status text, report_count bigint, eligible_at timestamptz,
               approvals bigint, quorum_m int, quorum_n int, mine boolean)
language sql security definer set search_path = public as $$
  select c.id, c.status,
         (select count(*) from reports r where r.case_id = c.id and r.status in ('sealed','released')),
         c.eligible_at,
         (select count(*) from approvals a where a.case_id = c.id and a.decision = 'approve'),
         o.quorum_m, o.quorum_n,
         exists (select 1 from approvals a where a.case_id = c.id and a.steward_id = s.id)
    from stewards s
    join cases c on c.org_id = s.org_id and c.status in ('eligible','approved')
    join orgs o on o.id = c.org_id
   where s.tide_user_id = p_tide_user and s.active
   order by c.eligible_at;
$$;

-- Records one approval. Returns the case status after it, 'invalid' if the case is not eligible,
-- or null if the caller is not an active steward of the case's org / the case is unknown.
create function steward_approve(p_tide_user text, p_case uuid, p_signature text)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_steward uuid; v_org uuid; v_status text; v_m int; v_count int;
begin
  select c.org_id, c.status, o.quorum_m into v_org, v_status, v_m
    from cases c join orgs o on o.id = c.org_id where c.id = p_case;
  if not found then return null; end if;

  select id into v_steward from stewards
   where tide_user_id = p_tide_user and org_id = v_org and active;
  if not found then return null; end if;

  if v_status <> 'eligible' then return 'invalid'; end if;

  insert into approvals (case_id, steward_id, decision, tide_signature)
    values (p_case, v_steward, 'approve', p_signature)
    on conflict (case_id, steward_id) do nothing;
  if not found then return v_status; end if; -- already approved: no second audit entry

  insert into audit_log (org_id, case_id, event) values (v_org, p_case, 'approval');

  select count(*) into v_count from approvals where case_id = p_case and decision = 'approve';
  if v_count >= v_m then
    update cases set status = 'approved' where id = p_case and status = 'eligible';
    return 'approved';
  end if;
  return v_status;
end $$;

revoke execute on function steward_cases, steward_approve from public;
grant execute on function steward_cases, steward_approve to service_role;
