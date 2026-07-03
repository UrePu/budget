-- 메소 가계부 스키마
-- Supabase SQL Editor 에서 실행하세요.

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null,
  type text not null check (type in ('deposit', 'withdraw')),
  currency text not null check (currency in ('meso', 'krw')),
  amount numeric not null check (amount > 0),
  rate numeric check (rate is null or rate > 0),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_occurred_at_idx
  on public.transactions (occurred_at desc);

-- service role 키로만 접근하므로 RLS를 켜두고 정책은 만들지 않는다.
-- (anon 키로는 아무것도 읽고 쓸 수 없음)
alter table public.transactions enable row level security;
