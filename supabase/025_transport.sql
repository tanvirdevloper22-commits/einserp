-- School transport (migration 025)
-- Supabase Dashboard -> SQL Editor: paste this whole file and Run.
-- Run it after 002_roles.sql and 008_parent_portal.sql (it uses app_role() and is_my_child()). Safe to run more than once.

create table if not exists transport_vehicles (
  id uuid primary key default gen_random_uuid(),
  reg_no text not null check (char_length(reg_no) between 3 and 20),
  vehicle_type text not null default 'bus' check (vehicle_type in ('bus', 'van', 'auto', 'other')),
  capacity int not null default 40 check (capacity between 1 and 200),
  driver_name text,
  driver_phone text,
  attendant_name text,
  insurance_expiry date,
  fitness_expiry date,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);
create unique index if not exists transport_vehicles_reg_key on transport_vehicles (lower(reg_no));

create table if not exists transport_routes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  vehicle_id uuid references transport_vehicles(id) on delete set null,
  monthly_fee numeric(10, 2) not null default 0 check (monthly_fee >= 0),
  notes text check (notes is null or char_length(notes) <= 300),
  created_at timestamptz not null default now()
);
create unique index if not exists transport_routes_name_key on transport_routes (lower(name));

create table if not exists transport_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references transport_routes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  pickup_time time,
  sort_order int not null default 0
);
create index if not exists transport_stops_route_idx on transport_stops (route_id, sort_order);

-- A student uses at most one route. A route that still has students cannot be deleted.
create table if not exists student_transport (
  student_id uuid primary key references students(id) on delete cascade,
  route_id uuid not null references transport_routes(id) on delete restrict,
  stop_id uuid references transport_stops(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists student_transport_route_idx on student_transport (route_id);

-- Helpers for the parent policies (security definer so they can read student_transport and routes).
create or replace function is_my_route(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from student_transport st
    join parent_students ps on ps.student_id = st.student_id
    where st.route_id = rid and ps.parent_id = auth.uid()
  );
$$;
create or replace function is_my_vehicle(vid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from transport_routes r
    join student_transport st on st.route_id = r.id
    join parent_students ps on ps.student_id = st.student_id
    where r.vehicle_id = vid and ps.parent_id = auth.uid()
  );
$$;

alter table transport_vehicles enable row level security;
alter table transport_routes enable row level security;
alter table transport_stops enable row level security;
alter table student_transport enable row level security;

do $$
declare t text;
begin
  foreach t in array array['transport_vehicles', 'transport_routes', 'transport_stops', 'student_transport'] loop
    execute format('drop policy if exists "%1$s admin" on %1$s', t);
    execute format('create policy "%1$s admin" on %1$s for all to authenticated using (app_role() = ''admin'') with check (app_role() = ''admin'')', t);
    execute format('drop policy if exists "%1$s staff read" on %1$s', t);
    execute format('create policy "%1$s staff read" on %1$s for select to authenticated using (app_role() in (''accountant'', ''teacher''))', t);
  end loop;
end $$;

-- Parents see only the route, stops, vehicle and boarding record of their own children.
drop policy if exists "student_transport parent read" on student_transport;
create policy "student_transport parent read" on student_transport for select to authenticated
  using (app_role() = 'parent' and is_my_child(student_id));
drop policy if exists "transport_routes parent read" on transport_routes;
create policy "transport_routes parent read" on transport_routes for select to authenticated
  using (app_role() = 'parent' and is_my_route(id));
drop policy if exists "transport_stops parent read" on transport_stops;
create policy "transport_stops parent read" on transport_stops for select to authenticated
  using (app_role() = 'parent' and is_my_route(route_id));
drop policy if exists "transport_vehicles parent read" on transport_vehicles;
create policy "transport_vehicles parent read" on transport_vehicles for select to authenticated
  using (app_role() = 'parent' and is_my_vehicle(id));
