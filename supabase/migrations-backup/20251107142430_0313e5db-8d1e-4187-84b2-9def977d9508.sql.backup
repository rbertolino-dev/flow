-- Create function to check user role without requiring enum
create or replace function public.has_role(_user_id uuid, _role text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role::text = _role
  );
$$;

-- Create auth audit logs table if it doesn't exist
create table if not exists public.auth_audit_logs (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  success boolean not null,
  error text,
  ip text,
  user_agent text,
  method text,
  user_id uuid,
  created_at timestamptz not null default now()
);

-- Enable RLS and admin-only read access
alter table public.auth_audit_logs enable row level security;

-- Drop existing select policy if any to replace with correct one
do $$
begin
  if exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'auth_audit_logs' and policyname = 'Admins can read auth audit logs'
  ) then
    execute 'drop policy "Admins can read auth audit logs" on public.auth_audit_logs';
  end if;
end $$;

create policy "Admins can read auth audit logs"
  on public.auth_audit_logs
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Helpful indexes
create index if not exists idx_auth_audit_logs_created_at on public.auth_audit_logs (created_at desc);
create index if not exists idx_auth_audit_logs_email on public.auth_audit_logs (email);
