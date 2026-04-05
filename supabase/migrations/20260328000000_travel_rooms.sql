create table if not exists travel_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid references auth.users(id) not null,
  destination text not null,
  start_date text not null,
  end_date text not null,
  status text not null default 'gathering' check (status in ('gathering', 'generating', 'completed')),
  trip_id uuid references trips(id),
  invite_code text not null unique default substr(md5(random()::text), 1, 8),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists travel_room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references travel_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  display_name text not null default '',
  mbti_style text not null default '',
  travel_pace text not null default 'moderate',
  budget_range text not null default 'moderate',
  stamina text not null default 'moderate',
  special_note text,
  joined_at timestamptz default now(),
  unique(room_id, user_id)
);

alter table travel_rooms enable row level security;
alter table travel_room_members enable row level security;

create policy "Users can view rooms they are members of" on travel_rooms
  for select using (
    id in (select room_id from travel_room_members where user_id = auth.uid())
    or host_id = auth.uid()
  );

create policy "Authenticated users can create rooms" on travel_rooms
  for insert with check (auth.uid() = host_id);

create policy "Host can update room" on travel_rooms
  for update using (auth.uid() = host_id);

create policy "Members can view room members" on travel_room_members
  for select using (
    room_id in (select room_id from travel_room_members where user_id = auth.uid())
  );

create policy "Authenticated users can join rooms" on travel_room_members
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own membership" on travel_room_members
  for update using (auth.uid() = user_id);
