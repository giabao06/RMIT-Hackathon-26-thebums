-- MOCK DATA for development only. Run in the Supabase SQL editor after 001-008. Safe to re-run.
-- Creates Supabase Auth users (email + password) and gives two of them a role:
--   admin@mock.safethreshold.test   -> org admin   (org_admins)
--   staff@mock.safethreshold.test   -> investigator (investigators)
--   student1..5@mock.safethreshold.test -> auth users with NO role (reporters never need an account;
--                                          they exist only so the admin can add them as stewards when testing)
-- Change the password below before running, and never use this script against real data.

do $$
declare
  v_password constant text := 'ChangeMe-Mock-123';   -- <- change me
  v_org uuid;
  v_id uuid;
  v_email text;
  v_name text;
begin
  select id into v_org from public.orgs order by name limit 1;
  if v_org is null then
    insert into public.orgs (name) values ('Demo University') returning id into v_org;
  end if;

  for v_email, v_name in
    values ('admin@mock.safethreshold.test', 'Mock Admin'),
           ('staff@mock.safethreshold.test', 'Mock Staff'),
           ('student1@mock.safethreshold.test', 'Mock Student 1'),
           ('student2@mock.safethreshold.test', 'Mock Student 2'),
           ('student3@mock.safethreshold.test', 'Mock Student 3'),
           ('student4@mock.safethreshold.test', 'Mock Student 4'),
           ('student5@mock.safethreshold.test', 'Mock Student 5')
  loop
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
        '{"provider":"email","providers":["email"]}', jsonb_build_object('name', v_name), now(), now(),
        '', '', '', ''
      );
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), v_id, v_id::text, 'email',
              jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), now(), now(), now());
    end if;

    -- Roles are rows keyed by the Supabase user id (the column is still named tide_user_id).
    if v_email like 'admin@%' then
      insert into public.org_admins (org_id, tide_user_id) values (v_org, v_id::text)
        on conflict (tide_user_id) do nothing;
    elsif v_email like 'staff@%' then
      insert into public.investigators (org_id, tide_user_id, name)
        select v_org, v_id::text, v_name
         where not exists (select 1 from public.investigators where tide_user_id = v_id::text);
    end if;
  end loop;
end $$;

-- Check: users and roles.
select u.email,
       exists (select 1 from public.org_admins a where a.tide_user_id = u.id::text) as is_admin,
       exists (select 1 from public.investigators i where i.tide_user_id = u.id::text) as is_investigator
  from auth.users u
 where u.email like '%@mock.safethreshold.test'
 order by u.email;
