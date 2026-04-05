-- user_profiles
create table if not exists public.user_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mbti_style text not null,
  travel_pace text not null check (travel_pace in ('relaxed', 'moderate', 'active')),
  food_preference text[] not null default '{}',
  budget_range text not null check (budget_range in ('budget', 'moderate', 'luxury')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

-- trips
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  destination text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'draft' check (status in ('draft', 'generated', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- trip_items
create table if not exists public.trip_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_number integer not null,
  order_index integer not null,
  place_id text not null,
  place_name_snapshot text not null,
  category text not null,
  start_time time not null,
  end_time time not null,
  estimated_cost integer not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- indexes
create index idx_trips_user_id on public.trips(user_id);
create index idx_trip_items_trip_id on public.trip_items(trip_id);
create index idx_trip_items_day_order on public.trip_items(trip_id, day_number, order_index);
