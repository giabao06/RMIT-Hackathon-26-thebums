-- MOCK DATA for development only. Run in the Supabase SQL editor after seed_mock.sql. Safe to re-run.
-- Makes student1 and student2 stewards (with steward@mock... from seed_steward_investigator.sql that is 3, the minimum).
-- This skips the admin-quorum flow on purpose; real stewards are added in /admin by email.
-- Each steward must still sign in and open /quorum once to create their key.

insert into public.stewards (org_id, tide_user_id, display_name, body)
select (select id from public.orgs order by name limit 1), u.id::text, v.display_name, v.body
  from (values ('student1@mock.safethreshold.test', 'Mock Steward 2', 'ngo'),
               ('student2@mock.safethreshold.test', 'Mock Steward 3', 'oversight')) as v(email, display_name, body)
  join auth.users u on u.email = v.email
 where not exists (select 1 from public.stewards s where s.tide_user_id = u.id::text and s.active);

select s.display_name, s.body, u.email, s.public_key is not null as has_key
  from public.stewards s join auth.users u on u.id::text = s.tide_user_id
 where s.active order by s.joined_at;
