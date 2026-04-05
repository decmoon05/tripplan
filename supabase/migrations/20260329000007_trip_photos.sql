-- NOTE: Supabase Storage bucket 'trip-photos' must be created manually
-- via the Supabase dashboard before photos can be uploaded.
-- Settings: Public bucket, file size limit 10MB, allowed MIME: image/*

create table if not exists trip_photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  storage_path text not null,
  caption text,
  day_number int,
  created_at timestamptz default now()
);

alter table trip_photos enable row level security;

create policy "Users can view their own trip photos" on trip_photos
  for select using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can insert photos for their trips" on trip_photos
  for insert with check (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can update their own trip photos" on trip_photos
  for update using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can delete their own trip photos" on trip_photos
  for delete using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create index if not exists idx_trip_photos_trip_id on trip_photos(trip_id);
create index if not exists idx_trip_photos_day_number on trip_photos(trip_id, day_number);
