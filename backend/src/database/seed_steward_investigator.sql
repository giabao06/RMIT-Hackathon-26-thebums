-- MOCK DATA for development only. Run in the Supabase SQL editor after 001-008. Safe to re-run.
-- Creates two Supabase Auth users and gives each its role row:
--   steward@mock.safethreshold.test       -> steward (body 'union')
--   investigator@mock.safethreshold.test  -> investigator
-- Change the password before running. Their keys are created on first visit to /quorum.

do $$
declare
  v_password constant text := 'ChangeMe-Mock-123';   -- <- change me
  v_org uuid;
  v_id uuid;
  v_email text;
begin
  select id into v_org from public.orgs order by name limit 1;
  if v_org is null then raise exception 'no org: run 001_init.sql and insert one first'; end if;

  foreach v_email in array array['steward@mock.safethreshold.test', 'investigator@mock.safethreshold.test'] loop
    select id into v_id from auth.users where email = v_email;
    if v_id is null then
      v_id := gen_random_uuid();
      -- The empty-string token columns matter: NULLs there break Supabase Auth sign-in.
      insert into auth.users (
        instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change, email_change_token_new
      ) values (
        '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
        extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
        '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, 'email',
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());
    end if;

    -- The role is a row keyed by the Supabase user id (the column is still named tide_user_id).
    if v_email like 'steward@%' then
      insert into public.stewards (org_id, tide_user_id, display_name, body)
        select v_org, v_id::text, 'Mock Steward', 'union'
         where not exists (select 1 from public.stewards where tide_user_id = v_id::text and active);
    else
      insert into public.investigators (org_id, tide_user_id, name)
        select v_org, v_id::text, 'Mock Investigator'
         where not exists (select 1 from public.investigators where tide_user_id = v_id::text and active);
    end if;
  end loop;
end $$;

select u.email,
       exists (select 1 from public.stewards s where s.tide_user_id = u.id::text and s.active) as is_steward,
       exists (select 1 from public.investigators i where i.tide_user_id = u.id::text and i.active) as is_investigator
  from auth.users u
 where u.email in ('steward@mock.safethreshold.test', 'investigator@mock.safethreshold.test');
