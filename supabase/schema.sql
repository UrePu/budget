-- 메소 가계부 스키마
-- Supabase SQL Editor 에서 실행하세요. (이미 적용된 마이그레이션의 최종 상태)

-- 계정: 아이디 없이 비밀번호 하나로 로그인하므로,
-- 비밀번호의 HMAC-SHA256(서버 AUTH_SECRET 을 pepper 로 사용) 해시를 식별자로 저장한다.
-- DB 만 유출돼서는 pepper 없이 비밀번호를 복원/대입할 수 없다.
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  password_hmac text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  occurred_at timestamptz not null,
  -- deposit/withdraw: 입출금, exchange_to_krw: 메소→원 환전, exchange_to_meso: 원→메소 환전
  type text not null check (type in ('deposit', 'withdraw', 'exchange_to_krw', 'exchange_to_meso')),
  currency text not null check (currency in ('meso', 'krw')),
  amount numeric not null check (amount > 0),
  rate numeric check (rate is null or rate > 0),
  tag text,
  created_at timestamptz not null default now(),
  -- 환전은 currency='meso' 고정 + rate 필수 (amount=메소 양, 원화 = amount/1억 * rate)
  constraint transactions_exchange_check check (
    type not in ('exchange_to_krw', 'exchange_to_meso')
    or (currency = 'meso' and rate is not null)
  )
);

create index if not exists transactions_account_occurred_idx
  on public.transactions (account_id, occurred_at desc);

-- service role 키로만 접근하므로 RLS를 켜두고 정책은 만들지 않는다.
-- (anon 키로는 아무것도 읽고 쓸 수 없음)
alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
