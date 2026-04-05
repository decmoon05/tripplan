create table if not exists trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references trips(id) on delete cascade not null,
  category text not null default '기타' check (category in ('숙박', '교통', '식비', '관광', '쇼핑', '기타')),
  amount numeric(12, 2) not null check (amount >= 0),
  currency text not null default 'KRW',
  memo text,
  date text,
  created_at timestamptz default now()
);

alter table trip_expenses enable row level security;

create policy "Users can view their own trip expenses" on trip_expenses
  for select using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can insert expenses for their trips" on trip_expenses
  for insert with check (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can update their own expenses" on trip_expenses
  for update using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create policy "Users can delete their own expenses" on trip_expenses
  for delete using (
    trip_id in (select id from trips where user_id = auth.uid())
  );

create index if not exists idx_trip_expenses_trip_id on trip_expenses(trip_id);
