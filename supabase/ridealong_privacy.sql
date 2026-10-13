-- =====================================================================
-- Ride Along: privacy update (phone numbers, account deletion)
-- =====================================================================
-- Run this whole file once in Supabase > SQL Editor. Safe to run again.
-- Run it BEFORE pushing the matching app update.
--
-- 1. Phone numbers and emails can no longer be read straight from the
--    users table. Each person reads their own through get_my_profile(), and
--    other people's phone numbers only through get_contact_phones(), which
--    returns a number only when the two people share a booking (or you're
--    an admin).
-- 2. delete_my_account() lets a signed-in user delete their account
--    (Google Play requirement).
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Your own profile, including phone and email
-- ---------------------------------------------------------------------
create or replace function public.get_my_profile()
returns setof public.users
language sql
stable
security definer
set search_path = public
as $$
  select * from public.users where id = auth.uid();
$$;

revoke execute on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;


-- ---------------------------------------------------------------------
-- 2. Other people's phone numbers, only when you're allowed to see them
-- ---------------------------------------------------------------------
-- Allowed: yourself; an admin; the driver of a trip you booked; a passenger
-- who booked your trip (confirmed or completed bookings only).
create or replace function public.get_contact_phones(p_users uuid[])
returns table (id uuid, phone text)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.phone
  from public.users u
  where u.id = any(p_users)
    and auth.uid() is not null
    and (
      u.id = auth.uid()
      or public.is_admin()
      or exists (
        select 1
        from public.bookings b
        join public.trips t on t.id = b.trip_id
        where b.status in ('confirmed', 'completed')
          and (
            (b.passenger_id = auth.uid() and t.driver_id = u.id)
            or (t.driver_id = auth.uid() and b.passenger_id = u.id)
          )
      )
    );
$$;

revoke execute on function public.get_contact_phones(uuid[]) from public, anon;
grant execute on function public.get_contact_phones(uuid[]) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Stop direct reading of phone and email columns
-- ---------------------------------------------------------------------
-- Signed-in users and visitors can still read every other column (name,
-- photo, role...). Updating your own phone number still works.
do $$
declare
  cols text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
    into cols
  from information_schema.columns
  where table_schema = 'public' and table_name = 'users'
    and column_name not in ('phone', 'email');

  execute 'revoke select on public.users from anon, authenticated';
  execute format('grant select (%s) on public.users to anon, authenticated', cols);
end $$;


-- ---------------------------------------------------------------------
-- 4. Delete my account
-- ---------------------------------------------------------------------
-- Removes the person's details and makes the login unusable. Trips and
-- bookings they were part of stay (other people's records depend on them)
-- but no longer point to a name or phone number.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'You need to be signed in to delete your account';
  end if;

  -- Upcoming bookings are cancelled (seats go back, the driver is notified)
  update public.bookings
     set status = 'cancelled', cancelled_at = now()
   where passenger_id = uid and status = 'confirmed';

  -- A driver's upcoming trips are cancelled (passengers are notified)
  update public.trips
     set status = 'cancelled', cancelled_at = now()
   where driver_id = uid and status in ('scheduled', 'departed');

  delete from public.driver_locations where driver_id = uid;
  delete from public.notifications where user_id = uid;
  delete from public.messages where sender_id = uid;
  update public.bookings set hidden_by_passenger = true where passenger_id = uid;
  update public.reviews set comment = null where passenger_id = uid;

  begin
    delete from public.favorites where passenger_id = uid or driver_id = uid;
  exception when others then null; -- table or columns may differ
  end;

  -- Driver details
  perform set_config('ridealong.system', 'on', true);
  begin
    delete from public.driver_profiles where id = uid;
  exception when others then
    update public.driver_profiles
       set vehicle_plate = 'deleted', vehicle_color = null, skills = null, status = 'offline'
     where id = uid;
  end;
  perform set_config('ridealong.system', 'off', true);

  -- Personal details
  update public.users
     set full_name = 'Deleted user',
         phone = 'deleted:' || uid::text,
         email = null,
         avatar_url = null
   where id = uid;

  -- Login: remove sessions and make the account impossible to sign in to
  delete from auth.sessions where user_id = uid;
  begin
    delete from auth.refresh_tokens where user_id = uid::text;
  exception when others then null;
  end;
  delete from auth.identities where user_id = uid;
  update auth.users
     set email = uid::text || '@deleted.invalid',
         phone = null,
         encrypted_password = '',
         raw_user_meta_data = '{}'::jsonb,
         banned_until = 'infinity'
   where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
