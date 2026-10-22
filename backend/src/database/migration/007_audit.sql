-- Hash-chained public audit log and refusal events. Run after 006_admin.sql.
-- Each row's hash = sha256(prev_hash || utf8('id|org|case|event|UTC timestamp')), so editing or
-- removing any row breaks every hash after it. See audit_row_hash for the exact formula; anyone
-- can recompute it from GET /audit. Rows carry no content, token, actor or IP.

alter table audit_log alter column org_id drop not null; -- refusals have no org

alter table audit_log drop constraint audit_log_event_check;
alter table audit_log add constraint audit_log_event_check
  check (event in ('report_sealed','case_eligible','approval','released','closed','withdrawn','expired',
                   'settings_changed','steward_added','steward_removed','steward_rotated',
                   'investigator_added','investigator_removed','investigator_assigned',
                   'forgery_refused','escalation_refused'));

create function audit_row_hash(p_prev bytea, p_id bigint, p_org uuid, p_case uuid, p_event text, p_at timestamptz)
returns bytea
language sql stable set search_path = public as $$
  select sha256(coalesce(p_prev, ''::bytea) || convert_to(
    p_id || '|' || coalesce(p_org::text, '') || '|' || coalesce(p_case::text, '') || '|' || p_event || '|' ||
    to_char(p_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.US'), 'utf8'));
$$;

-- Serialises inserts; the id is drawn after the lock so id order is chain order.
create function audit_chain() returns trigger
language plpgsql as $$
begin
  perform pg_advisory_xact_lock(7001);
  new.id := nextval(pg_get_serial_sequence('audit_log', 'id'));
  select hash into new.prev_hash from audit_log order by id desc limit 1;
  new.hash := audit_row_hash(new.prev_hash, new.id, new.org_id, new.case_id, new.event, new.created_at);
  return new;
end $$;

-- Chain the rows that already exist, then lock the table down.
do $$
declare r audit_log; v_prev bytea := null; v_hash bytea;
begin
  for r in select * from audit_log order by id loop
    v_hash := audit_row_hash(v_prev, r.id, r.org_id, r.case_id, r.event, r.created_at);
    update audit_log set prev_hash = v_prev, hash = v_hash where id = r.id;
    v_prev := v_hash;
  end loop;
end $$;

create trigger audit_chain_insert before insert on audit_log
  for each row execute function audit_chain();

create function audit_readonly() returns trigger
language plpgsql as $$
begin
  raise exception 'audit_log is append-only';
end $$;
create trigger audit_no_change before update or delete on audit_log
  for each row execute function audit_readonly();
create trigger audit_no_truncate before truncate on audit_log
  for each statement execute function audit_readonly();
revoke update, delete, truncate on audit_log from anon, authenticated, service_role;

-- First row whose hash does not recompute or does not link to the row before it; null = intact.
-- Truncating the tail is invisible here: keep a copy of an earlier head hash to catch that.
create function audit_verify() returns bigint
language sql stable security definer set search_path = public as $$
  select id from (
    select id, hash, prev_hash,
           lag(hash) over (order by id) as expected_prev,
           audit_row_hash(prev_hash, id, org_id, case_id, event, created_at) as recomputed
      from audit_log) t
   where hash is distinct from recomputed or prev_hash is distinct from expected_prev
   order by id limit 1;
$$;

create function audit_entries(p_limit int default 500)
returns table (id bigint, case_id uuid, event text, created_at timestamptz, prev_hash text, hash text)
language sql stable security definer set search_path = public as $$
  select a.id, a.case_id, a.event, a.created_at, encode(a.prev_hash, 'hex'), encode(a.hash, 'hex')
    from audit_log a order by a.id desc limit least(greatest(p_limit, 1), 1000);
$$;

-- Refused forgery and escalation attempts. Nothing about the caller is stored.
create function log_refusal(p_event text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_event not in ('forgery_refused','escalation_refused') then raise exception 'bad event'; end if;
  insert into audit_log (event) values (p_event);
end $$;

revoke execute on function audit_row_hash, audit_chain, audit_readonly, audit_verify, audit_entries, log_refusal from public;
grant execute on function audit_verify, audit_entries, log_refusal to service_role;
