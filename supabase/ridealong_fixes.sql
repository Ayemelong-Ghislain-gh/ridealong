-- =====================================================================
-- Ride Along: database fixes that go with the October 2026 app update
-- =====================================================================
-- Run this whole file once in Supabase: Dashboard > SQL Editor > New query,
-- paste, Run. It is safe to run again; every step checks before it changes.
--
-- Run it BEFORE deploying the new app. The app now filters bookings on
-- `hidden_by_passenger`, which this script adds.
--
-- Before running, look at what triggers you already have (step 0) so you
-- know whether your seat counting lives in triggers already.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 0. LOOK FIRST (read-only). Run this on its own and keep the output.
-- ---------------------------------------------------------------------
-- select event_object_table as table_name, trigger_name, action_timing, event_manipulation
-- from information_schema.triggers
-- where trigger_schema = 'public'
-- order by 1, 2;


-- ---------------------------------------------------------------------
-- 1. New columns
-- ---------------------------------------------------------------------
-- Passengers "remove" old bookings from their list without deleting the
-- record the driver relies on.
alter table public.bookings add column if not exists hidden_by_passenger boolean not null default false;

-- Driver "Other services" list (the Profile page already writes this).
alter table public.driver_profiles add column if not exists skills text[];


-- ---------------------------------------------------------------------
-- 2. Helpers
-- ---------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.users where id = auth.uid() and role = 'admin');
$$;

-- True while one of our own triggers is writing protected columns
-- (ratings, trip counts), so the protection triggers let it through.
create or replace function public.is_system_write()
returns boolean
language sql
stable
as $$
  select coalesce(current_setting('ridealong.system', true), '') = 'on';
$$;

-- Insert a notification without ever breaking the action that caused it.
create or replace function public.notify_user(p_user uuid, p_type text, p_title text, p_message text, p_data jsonb default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user is null then return; end if;
  insert into public.notifications (user_id, type, title, message, data, is_read)
  values (p_user, p_type, p_title, p_message, p_data, false);
exception when others then
  raise warning 'notify_user failed: %', sqlerrm;
end;
$$;


-- ---------------------------------------------------------------------
-- 3. Notifications table (skipped if it already exists)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  message text not null,
  data jsonb,
  is_read boolean not null default false,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
-- In case an older notifications table exists without these columns
alter table public.notifications add column if not exists data jsonb;
alter table public.notifications add column if not exists is_read boolean not null default false;
alter table public.notifications add column if not exists read_at timestamptz;

create index if not exists notifications_user_created_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

drop policy if exists "Users read own notifications" on public.notifications;
create policy "Users read own notifications" on public.notifications
  for select using (user_id = auth.uid());

drop policy if exists "Users mark own notifications read" on public.notifications;
create policy "Users mark own notifications read" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Live updates for the bell icon
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when duplicate_object then null;
end $$;


-- ---------------------------------------------------------------------
-- 4. Create the profile automatically at sign-up
-- ---------------------------------------------------------------------
-- The app sends name, phone, role and vehicle details as sign-up metadata.
-- This makes sure the profile exists even when email confirmation is on
-- (no session yet, so the app can't insert it itself) and stops accounts
-- getting stuck half-created.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := case when meta->>'role' = 'driver' then 'driver' else 'passenger' end;
begin
  if coalesce(meta->>'phone', '') = '' then
    return new; -- not created by the Ride Along sign-up form
  end if;

  begin
    insert into public.users (id, full_name, email, phone, role, is_verified)
    values (new.id, coalesce(meta->>'full_name', ''), nullif(meta->>'email', ''), meta->>'phone', v_role, false)
    on conflict (id) do nothing;

    if v_role = 'driver' then
      insert into public.driver_profiles
        (id, vehicle_make, vehicle_model, vehicle_color, vehicle_plate, vehicle_capacity,
         is_verified_driver, rating, total_trips, status)
      values
        (new.id, meta->>'vehicle_make', meta->>'vehicle_model', nullif(meta->>'vehicle_color', ''),
         meta->>'vehicle_plate', nullif(meta->>'vehicle_capacity', '')::int,
         false, 0, 0, 'offline')
      on conflict (id) do nothing;
    end if;
  exception when others then
    -- Never block sign-up; the app retries the profile insert itself.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 5. Protect columns users must not set themselves
-- ---------------------------------------------------------------------
-- Without this, anyone can call the API directly and make themselves an
-- admin, a verified driver, or give themselves a 5.0 rating.
-- The SQL editor (no signed-in user) and admins are allowed through.
create or replace function public.protect_user_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or public.is_system_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified := false;
    if new.role is distinct from 'driver' then new.role := 'passenger'; end if;
  else
    new.role := old.role;
    new.is_verified := old.is_verified;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_user_columns on public.users;
create trigger protect_user_columns
  before insert or update on public.users
  for each row execute function public.protect_user_columns();

create or replace function public.protect_driver_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or public.is_admin() or public.is_system_write() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.is_verified_driver := false;
    new.rating := 0;
    new.total_trips := 0;
  else
    new.is_verified_driver := old.is_verified_driver;
    new.rating := old.rating;
    new.total_trips := old.total_trips;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_driver_columns on public.driver_profiles;
create trigger protect_driver_columns
  before insert or update on public.driver_profiles
  for each row execute function public.protect_driver_columns();

-- Admin page: let admins update any driver profile (verification badge)
drop policy if exists "Admins update driver profiles" on public.driver_profiles;
create policy "Admins update driver profiles" on public.driver_profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read all driver profiles" on public.driver_profiles;
create policy "Admins read all driver profiles" on public.driver_profiles
  for select using (public.is_admin());


-- ---------------------------------------------------------------------
-- 6. Editing total seats can't overwrite bookings made meanwhile
-- ---------------------------------------------------------------------
-- When a driver changes total seats, available seats are recalculated from
-- the confirmed bookings at that moment, instead of trusting the number
-- the app worked out when the edit page opened.
create or replace function public.recalc_available_seats()
returns trigger
language plpgsql
as $$
declare
  booked int;
begin
  if new.total_seats is distinct from old.total_seats then
    select coalesce(sum(seats_booked), 0) into booked
    from public.bookings
    where trip_id = new.id and status = 'confirmed';

    if new.total_seats < booked then
      raise exception 'Total seats can''t be less than the % seats already booked', booked;
    end if;
    new.available_seats := new.total_seats - booked;
  end if;
  return new;
end;
$$;

drop trigger if exists recalc_available_seats on public.trips;
create trigger recalc_available_seats
  before update of total_seats on public.trips
  for each row execute function public.recalc_available_seats();


-- ---------------------------------------------------------------------
-- 7. Trip status changes reach the passengers' bookings
-- ---------------------------------------------------------------------
-- Cancelled trip  -> its confirmed bookings are cancelled + passengers notified
-- Completed trip  -> its confirmed bookings are completed (unlocks "Rate driver")
-- Departed trip   -> passengers notified their driver has left
-- Date/time/price changed -> passengers notified
create or replace function public.on_trip_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  b record;
  dest text;
  when_txt text;
begin
  select r.destination into dest from public.routes r where r.id = new.route_id;
  when_txt := to_char(new.departure_date, 'Dy DD Mon') || ' at ' || to_char(new.departure_time, 'HH24:MI');

  if new.status is distinct from old.status then
    if new.status = 'cancelled' then
      for b in select id, passenger_id from public.bookings where trip_id = new.id and status = 'confirmed' loop
        perform public.notify_user(b.passenger_id, 'trip_cancelled', 'Trip cancelled',
          'Your trip to ' || coalesce(dest, 'your destination') || ' on ' || when_txt || ' was cancelled by the driver.',
          jsonb_build_object('trip_id', new.id, 'booking_id', b.id));
      end loop;
      update public.bookings set status = 'cancelled', cancelled_at = now()
      where trip_id = new.id and status = 'confirmed';

    elsif new.status = 'completed' then
      update public.bookings set status = 'completed', completed_at = now()
      where trip_id = new.id and status = 'confirmed';

      perform set_config('ridealong.system', 'on', true);
      update public.driver_profiles set total_trips = coalesce(total_trips, 0) + 1 where id = new.driver_id;
      perform set_config('ridealong.system', 'off', true);

    elsif new.status = 'departed' then
      for b in select passenger_id from public.bookings where trip_id = new.id and status = 'confirmed' loop
        perform public.notify_user(b.passenger_id, 'trip_reminder', 'Your driver has left',
          'Your trip to ' || coalesce(dest, 'your destination') || ' is on the road. Open the booking to follow it on the map.',
          jsonb_build_object('trip_id', new.id));
      end loop;
    end if;

  elsif new.status = 'scheduled' and (
        new.departure_date is distinct from old.departure_date
     or new.departure_time is distinct from old.departure_time
     or new.price_per_seat is distinct from old.price_per_seat) then
    for b in select passenger_id from public.bookings where trip_id = new.id and status = 'confirmed' loop
      perform public.notify_user(b.passenger_id, 'trip_reminder', 'Trip details changed',
        'Your trip to ' || coalesce(dest, 'your destination') || ' is now ' || when_txt
          || ', ' || new.price_per_seat || ' XAF per seat.',
        jsonb_build_object('trip_id', new.id));
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists on_trip_changed on public.trips;
create trigger on_trip_changed
  after update on public.trips
  for each row execute function public.on_trip_changed();


-- ---------------------------------------------------------------------
-- 8. Tell drivers about new and cancelled bookings
-- ---------------------------------------------------------------------
create or replace function public.on_booking_changed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  t record;
  pname text;
begin
  select tr.driver_id, tr.status, tr.departure_date, tr.departure_time, r.destination
    into t
  from public.trips tr left join public.routes r on r.id = tr.route_id
  where tr.id = new.trip_id;

  select full_name into pname from public.users where id = new.passenger_id;

  if tg_op = 'INSERT' and new.status = 'confirmed' then
    perform public.notify_user(t.driver_id, 'booking_confirmed', 'New booking',
      coalesce(pname, 'A passenger') || ' booked ' || new.seats_booked || ' seat(s) to ' || coalesce(t.destination, 'your destination')
        || ' on ' || to_char(t.departure_date, 'Dy DD Mon') || ' at ' || to_char(t.departure_time, 'HH24:MI') || '.',
      jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id));

  elsif tg_op = 'UPDATE' and old.status = 'confirmed' and new.status = 'cancelled' and t.status = 'scheduled' then
    perform public.notify_user(t.driver_id, 'booking_cancelled', 'Booking cancelled',
      coalesce(pname, 'A passenger') || ' cancelled ' || new.seats_booked || ' seat(s) to ' || coalesce(t.destination, 'your destination') || '.',
      jsonb_build_object('trip_id', new.trip_id, 'booking_id', new.id));
  end if;

  return new;
end;
$$;

drop trigger if exists on_booking_changed on public.bookings;
create trigger on_booking_changed
  after insert or update of status on public.bookings
  for each row execute function public.on_booking_changed();


-- ---------------------------------------------------------------------
-- 9. Driver rating = average of their reviews
-- ---------------------------------------------------------------------
create or replace function public.refresh_driver_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d uuid := coalesce(new.driver_id, old.driver_id);
begin
  perform set_config('ridealong.system', 'on', true);
  update public.driver_profiles
  set rating = coalesce((select round(avg(rating)::numeric, 2) from public.reviews where driver_id = d), 0)
  where id = d;
  perform set_config('ridealong.system', 'off', true);
  return null;
end;
$$;

drop trigger if exists refresh_driver_rating on public.reviews;
create trigger refresh_driver_rating
  after insert or update or delete on public.reviews
  for each row execute function public.refresh_driver_rating();

-- Recalculate existing ratings once
do $$
begin
  perform set_config('ridealong.system', 'on', true);
  update public.driver_profiles dp
  set rating = coalesce((select round(avg(r.rating)::numeric, 2) from public.reviews r where r.driver_id = dp.id), 0);
  perform set_config('ridealong.system', 'off', true);
end $$;


-- ---------------------------------------------------------------------
-- 10. Live location: only passengers on a trip that's on the road
-- ---------------------------------------------------------------------
-- Replaces every existing policy on driver_locations.
alter table public.driver_locations enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'driver_locations' loop
    execute format('drop policy %I on public.driver_locations', p.policyname);
  end loop;
end $$;

create policy "Drivers manage own location" on public.driver_locations
  for all using (driver_id = auth.uid()) with check (driver_id = auth.uid());

create policy "Passengers see driver on departed trip" on public.driver_locations
  for select using (
    exists (
      select 1
      from public.bookings b
      join public.trips t on t.id = b.trip_id
      where t.driver_id = driver_locations.driver_id
        and t.status = 'departed'
        and b.passenger_id = auth.uid()
        and b.status = 'confirmed'
    )
  );


-- ---------------------------------------------------------------------
-- 11. Chat: only the passenger and driver of a booking
-- ---------------------------------------------------------------------
-- Replaces every existing policy on messages.
alter table public.messages enable row level security;

do $$
declare p record;
begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'messages' loop
    execute format('drop policy %I on public.messages', p.policyname);
  end loop;
end $$;

create policy "Booking parties read messages" on public.messages
  for select using (
    exists (
      select 1 from public.bookings b join public.trips t on t.id = b.trip_id
      where b.id = messages.booking_id and (b.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );

create policy "Booking parties send messages" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.bookings b join public.trips t on t.id = b.trip_id
      where b.id = messages.booking_id and (b.passenger_id = auth.uid() or t.driver_id = auth.uid())
    )
  );


-- ---------------------------------------------------------------------
-- 12. One account per phone number
-- ---------------------------------------------------------------------
-- If this step reports duplicates, fix those rows first, then run it again:
--   select phone, count(*) from public.users group by phone having count(*) > 1;
do $$
begin
  create unique index if not exists users_phone_unique on public.users (phone);
exception when unique_violation then
  raise notice 'Duplicate phone numbers exist; unique index not created. See the query above.';
end $$;


-- ---------------------------------------------------------------------
-- 13. Make yourself an admin (edit the phone number, then run)
-- ---------------------------------------------------------------------
-- update public.users set role = 'admin' where phone = '+237XXXXXXXXX';
