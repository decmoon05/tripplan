create table if not exists notification_preferences (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  enabled boolean not null default false,
  reminder_days_before int not null default 3 check (reminder_days_before between 1 and 30),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(trip_id, user_id)
);

alter table notification_preferences enable row level security;

create policy "Users can view their own notification preferences" on notification_preferences
  for select using (auth.uid() = user_id);

create policy "Users can insert their own notification preferences" on notification_preferences
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own notification preferences" on notification_preferences
  for update using (auth.uid() = user_id);

create policy "Users can delete their own notification preferences" on notification_preferences
  for delete using (auth.uid() = user_id);

create index if not exists idx_notification_preferences_trip_id on notification_preferences(trip_id);
create index if not exists idx_notification_preferences_user_id on notification_preferences(user_id);
