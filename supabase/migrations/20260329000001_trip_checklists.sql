create table if not exists trip_checklists (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  item text not null,
  checked boolean not null default false,
  category text not null default '기타' check (category in ('서류', '의류', '전자기기', '의약품', '기타')),
  created_at timestamptz default now()
);

alter table trip_checklists enable row level security;

create policy "Users can view their own trip checklists" on trip_checklists
  for select using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can insert checklist items for their trips" on trip_checklists
  for insert with check (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can update their own checklist items" on trip_checklists
  for update using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can delete their own checklist items" on trip_checklists
  for delete using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create index if not exists idx_trip_checklists_trip_id on trip_checklists(trip_id);
