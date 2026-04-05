create table if not exists trip_ratings (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  item_id uuid references trip_items(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  rating int not null check (rating between 1 and 5),
  created_at timestamptz default now(),
  unique(trip_id, item_id, user_id)
);

alter table trip_ratings enable row level security;

create policy "Users can view their own ratings" on trip_ratings
  for select using (auth.uid() = user_id);

create policy "Users can insert their own ratings" on trip_ratings
  for insert with check (
    auth.uid() = user_id
    and trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can update their own ratings" on trip_ratings
  for update using (auth.uid() = user_id);

create policy "Users can delete their own ratings" on trip_ratings
  for delete using (auth.uid() = user_id);

create index if not exists idx_trip_ratings_trip_id on trip_ratings(trip_id);
create index if not exists idx_trip_ratings_item_id on trip_ratings(item_id);
create index if not exists idx_trip_ratings_user_id on trip_ratings(user_id);
