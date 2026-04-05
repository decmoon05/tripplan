create table if not exists room_votes (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references travel_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  topic text not null,
  value text not null,
  created_at timestamptz default now(),
  unique(room_id, user_id, topic)
);

alter table room_votes enable row level security;

create policy "Room members can view votes" on room_votes
  for select using (
    room_id in (
      select room_id from travel_room_members where user_id = auth.uid()
    )
  );

create policy "Room members can vote" on room_votes
  for insert with check (
    auth.uid() = user_id
    and room_id in (
      select room_id from travel_room_members where user_id = auth.uid()
    )
  );

create policy "Users can update their own votes" on room_votes
  for update using (auth.uid() = user_id);

create policy "Users can delete their own votes" on room_votes
  for delete using (auth.uid() = user_id);

create index if not exists idx_room_votes_room_id on room_votes(room_id);
create index if not exists idx_room_votes_topic on room_votes(room_id, topic);
