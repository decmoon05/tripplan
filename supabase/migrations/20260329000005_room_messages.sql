create table if not exists room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references travel_rooms(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null check (length(content) > 0 and length(content) <= 1000),
  created_at timestamptz default now()
);

alter table room_messages enable row level security;

create policy "Room members can view messages" on room_messages
  for select using (
    room_id in (
      select room_id from travel_room_members where user_id = auth.uid()
    )
  );

create policy "Room members can send messages" on room_messages
  for insert with check (
    auth.uid() = user_id
    and room_id in (
      select room_id from travel_room_members where user_id = auth.uid()
    )
  );

create policy "Users can delete their own messages" on room_messages
  for delete using (auth.uid() = user_id);

create index if not exists idx_room_messages_room_id on room_messages(room_id);
create index if not exists idx_room_messages_created_at on room_messages(room_id, created_at desc);
