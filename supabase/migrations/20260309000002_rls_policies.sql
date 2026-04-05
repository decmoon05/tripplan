-- Enable RLS
alter table public.user_profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_items enable row level security;

-- user_profiles: users can only access their own profile
create policy "Users can view own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on public.user_profiles for insert
  with check (auth.uid() = user_id);

create policy "Users can update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id);

create policy "Users can delete own profile"
  on public.user_profiles for delete
  using (auth.uid() = user_id);

-- trips: users can only access their own trips
create policy "Users can view own trips"
  on public.trips for select
  using (auth.uid() = user_id);

create policy "Users can insert own trips"
  on public.trips for insert
  with check (auth.uid() = user_id);

create policy "Users can update own trips"
  on public.trips for update
  using (auth.uid() = user_id);

create policy "Users can delete own trips"
  on public.trips for delete
  using (auth.uid() = user_id);

-- trip_items: users can access items of their own trips
create policy "Users can view own trip items"
  on public.trip_items for select
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can insert own trip items"
  on public.trip_items for insert
  with check (
    exists (
      select 1 from public.trips
      where trips.id = trip_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can update own trip items"
  on public.trip_items for update
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_items.trip_id
        and trips.user_id = auth.uid()
    )
  );

create policy "Users can delete own trip items"
  on public.trip_items for delete
  using (
    exists (
      select 1 from public.trips
      where trips.id = trip_items.trip_id
        and trips.user_id = auth.uid()
    )
  );
