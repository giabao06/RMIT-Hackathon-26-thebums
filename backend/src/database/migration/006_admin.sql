-- Org admin with an admin quorum (IGA mirror). Run after 005_investigator.sql.
-- Every change to people or settings is a proposal that other admins must approve. The quorum is
-- max(1, floor(0.7 * active admins)) and is separate from the steward release quorum. Nothing here
-- reads ciphertext, tokens or keys: admins see people, settings and case status only.
-- Seed the first admin by hand: insert into org_admins (org_id, tide_user_id) values (..., ...);

create table org_admins (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  tide_user_id text not null unique,
  active boolean not null default true
);

create table admin_changes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references orgs(id),
  kind text not null check (kind in ('set_settings','add_steward','remove_steward','rotate_steward','add_investigator','remove_investigator')),
  payload jsonb not null,
  proposed_by uuid not null references org_admins(id),
  status text not null default 'pending' check (status in ('pending','applied','rejected')),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create table admin_change_approvals (
  change_id uuid not null references admin_changes(id) on delete cascade,
  admin_id uuid not null references org_admins(id),
  primary key (change_id, admin_id)
);

alter table org_admins enable row level security;
alter table admin_changes enable row level security;
alter table admin_change_approvals enable row level security;

alter table audit_log drop constraint audit_log_event_check;
alter table audit_log add constraint audit_log_event_check
  check (event in ('report_sealed','case_eligible','approval','released','closed','withdrawn','expired',
                   'settings_changed','steward_added','steward_removed','steward_rotated',
                   'investigator_added','investigator_removed','investigator_assigned'));

create function admin_required(p_org uuid) returns int
language sql stable set search_path = public as $$
  select greatest(1, floor(0.7 * count(*))::int) from org_admins where org_id = p_org and active;
$$;

-- Applies a change, or returns false if it breaks a rule (the change is then rejected).
-- Org-level audit rows carry no case and no actor.
create function apply_admin_change(p_change uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  c admin_changes; o orgs; v_active int; v_ok boolean := true; v_event text; v_old stewards;
begin
  select * into c from admin_changes where id = p_change;
  select * into o from orgs where id = c.org_id;
  select count(*) into v_active from stewards where org_id = c.org_id and active;

  if c.kind = 'set_settings' then
    if (c.payload->>'retention_months')::int not between 12 and 18
       or (c.payload->>'quorum_n')::int not between 3 and 5
       or (c.payload->>'quorum_m')::int not between 2 and (c.payload->>'quorum_n')::int
       or (c.payload->>'quorum_n')::int > v_active then v_ok := false;
    else
      update orgs set retention_months = (c.payload->>'retention_months')::int,
                      quorum_m = (c.payload->>'quorum_m')::int,
                      quorum_n = (c.payload->>'quorum_n')::int where id = c.org_id;
      v_event := 'settings_changed';
    end if;
  elsif c.kind = 'add_steward' then
    if v_active >= 5 or exists (select 1 from stewards where org_id = c.org_id and active and tide_user_id = c.payload->>'tide_user_id') then v_ok := false;
    else
      insert into stewards (org_id, tide_user_id, display_name, body)
        values (c.org_id, c.payload->>'tide_user_id', c.payload->>'display_name', c.payload->>'body');
      v_event := 'steward_added';
    end if;
  elsif c.kind = 'remove_steward' then
    if v_active - 1 < o.quorum_n then v_ok := false;
    else
      update stewards set active = false, rotated_out_at = now()
       where id = (c.payload->>'id')::uuid and org_id = c.org_id and active;
      v_ok := found; v_event := 'steward_removed';
    end if;
  elsif c.kind = 'rotate_steward' then
    select * into v_old from stewards where id = (c.payload->>'id')::uuid and org_id = c.org_id and active;
    if not found or exists (select 1 from stewards where org_id = c.org_id and active and tide_user_id = c.payload->>'tide_user_id') then v_ok := false;
    else
      update stewards set active = false, rotated_out_at = now() where id = v_old.id;
      insert into stewards (org_id, tide_user_id, display_name, body)
        values (c.org_id, c.payload->>'tide_user_id', c.payload->>'display_name', v_old.body);
      v_event := 'steward_rotated';
    end if;
  elsif c.kind = 'add_investigator' then
    insert into investigators (org_id, tide_user_id, name)
      values (c.org_id, c.payload->>'tide_user_id', c.payload->>'name');
    v_event := 'investigator_added';
  elsif c.kind = 'remove_investigator' then
    update investigators set active = false
     where id = (c.payload->>'id')::uuid and org_id = c.org_id and active;
    v_ok := found; v_event := 'investigator_removed';
  end if;

  if v_ok then
    update admin_changes set status = 'applied', applied_at = now() where id = p_change;
    insert into audit_log (org_id, event) values (c.org_id, v_event);
  else
    update admin_changes set status = 'rejected' where id = p_change;
  end if;
  return v_ok;
end $$;

-- Opens a proposal; the proposer's approval counts. Returns {id, status} or null if not an active admin.
create function admin_propose(p_tide_user text, p_kind text, p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin org_admins; v_id uuid; v_status text := 'pending';
begin
  select * into v_admin from org_admins where tide_user_id = p_tide_user and active;
  if not found then return null; end if;

  insert into admin_changes (org_id, kind, payload, proposed_by)
    values (v_admin.org_id, p_kind, p_payload, v_admin.id) returning id into v_id;
  insert into admin_change_approvals (change_id, admin_id) values (v_id, v_admin.id);

  if admin_required(v_admin.org_id) <= 1 then
    perform apply_admin_change(v_id);
    select status into v_status from admin_changes where id = v_id;
  end if;
  return jsonb_build_object('id', v_id, 'status', v_status);
end $$;

-- Returns the change status after the vote, 'invalid' if it is not pending, or null if not allowed.
create function admin_approve(p_tide_user text, p_change uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_admin org_admins; c admin_changes;
begin
  select * into c from admin_changes where id = p_change;
  if not found then return null; end if;
  select * into v_admin from org_admins where tide_user_id = p_tide_user and org_id = c.org_id and active;
  if not found then return null; end if;
  if c.status <> 'pending' then return 'invalid'; end if;

  insert into admin_change_approvals (change_id, admin_id) values (p_change, v_admin.id)
    on conflict do nothing;
  if (select count(*) from admin_change_approvals a join org_admins m on m.id = a.admin_id and m.active
       where a.change_id = p_change) >= admin_required(c.org_id) then
    perform apply_admin_change(p_change);
  end if;
  return (select status from admin_changes where id = p_change);
end $$;

-- Any active admin may reject a pending change.
create function admin_reject(p_tide_user text, p_change uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  c admin_changes;
begin
  select * into c from admin_changes where id = p_change;
  if not found then return null; end if;
  if not exists (select 1 from org_admins where tide_user_id = p_tide_user and org_id = c.org_id and active) then return null; end if;
  if c.status <> 'pending' then return 'invalid'; end if;
  update admin_changes set status = 'rejected' where id = p_change;
  return 'rejected';
end $$;

-- Assigns an investigator to a released case. Returns 'assigned', 'invalid' or null.
create function admin_assign(p_tide_user text, p_case uuid, p_investigator uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_org uuid; v_status text;
begin
  select org_id, status into v_org, v_status from cases where id = p_case;
  if not found then return null; end if;
  if not exists (select 1 from org_admins where tide_user_id = p_tide_user and org_id = v_org and active) then return null; end if;
  if v_status <> 'released' or not exists (select 1 from investigators where id = p_investigator and org_id = v_org and active) then return 'invalid'; end if;
  insert into case_assignments (case_id, investigator_id) values (p_case, p_investigator) on conflict do nothing;
  insert into audit_log (org_id, case_id, event) values (v_org, p_case, 'investigator_assigned');
  return 'assigned';
end $$;

-- Everything an admin may see. No ciphertext, token or key column is selected anywhere.
create function admin_overview(p_tide_user text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_admin org_admins;
begin
  select * into v_admin from org_admins where tide_user_id = p_tide_user and active;
  if not found then return null; end if;
  return jsonb_build_object(
    'settings', (select jsonb_build_object('retention_months', retention_months, 'quorum_m', quorum_m, 'quorum_n', quorum_n)
                   from orgs where id = v_admin.org_id),
    'admin_quorum', jsonb_build_object('required', admin_required(v_admin.org_id),
                      'admins', (select count(*) from org_admins where org_id = v_admin.org_id and active)),
    'stewards', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'display_name', display_name, 'body', body) order by joined_at)
                   from stewards where org_id = v_admin.org_id and active), '[]'),
    'investigators', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'name', name))
                   from investigators where org_id = v_admin.org_id and active), '[]'),
    'changes', coalesce((select jsonb_agg(jsonb_build_object('id', ch.id, 'kind', ch.kind, 'payload', ch.payload,
                   'created_at', ch.created_at,
                   'approvals', (select count(*) from admin_change_approvals a where a.change_id = ch.id),
                   'mine', exists (select 1 from admin_change_approvals a where a.change_id = ch.id and a.admin_id = v_admin.id)
                   ) order by ch.created_at)
                   from admin_changes ch where ch.org_id = v_admin.org_id and ch.status = 'pending'), '[]'),
    'cases', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'status', status, 'eligible_at', eligible_at,
                   'assigned', exists (select 1 from case_assignments a where a.case_id = cases.id)) order by eligible_at)
                   from cases where org_id = v_admin.org_id and status <> 'open'), '[]')
  );
end $$;

revoke execute on function admin_required, apply_admin_change, admin_propose, admin_approve, admin_reject, admin_assign, admin_overview from public;
grant execute on function admin_required, admin_propose, admin_approve, admin_reject, admin_assign, admin_overview to service_role;
