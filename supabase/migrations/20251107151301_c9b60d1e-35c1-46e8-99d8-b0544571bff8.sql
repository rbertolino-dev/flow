-- Drop existing conflicting policies first
drop policy if exists "Admins or pubdigital can view all organizations" on public.organizations;
drop policy if exists "Admins or pubdigital can view all members" on public.organization_members;

-- Function to allow pubdigital users to access all orgs
create or replace function public.is_pubdigital_user(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_members om
    join public.organizations o on o.id = om.organization_id
    where om.user_id = _user_id
      and lower(o.name) like '%pubdigital%'
  );
$$;

-- Allow admins or pubdigital users to view all organizations
create policy "Super admins can view all organizations"
on public.organizations
for select
using (
  public.has_role(auth.uid(), 'admin'::app_role)
  or public.is_pubdigital_user(auth.uid())
);

-- Allow admins or pubdigital users to view all organization members
create policy "Super admins can view all members"
on public.organization_members
for select
using (
  public.has_role(auth.uid(), 'admin'::app_role)
  or public.is_pubdigital_user(auth.uid())
);
