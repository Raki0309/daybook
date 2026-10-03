-- Demo accounts are Supabase anonymous users (auth.users.is_anonymous).
-- They can use the app with example data, but nothing tied to a real person:
-- no Apple Health key, and a cap on how much a demo account can store, so a
-- bot that gets past the CAPTCHA can't fill the database.

create function public.is_demo_user(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select u.is_anonymous from auth.users u where u.id = p_uid), false)
$$;

revoke execute on function public.is_demo_user(uuid) from public, anon, authenticated;

-- 1. Apple Health keys: refused for demo accounts, in the function and on the table itself.
create or replace function public.create_health_token()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) or public.is_demo_user(v_uid) then
    raise exception 'Apple Health sync needs your own account, not the demo.' using errcode = '42501';
  end if;
  insert into public.health_tokens (user_id, token_hash)
  values (v_uid, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used = null;
  return v_token;
end
$$;

create function public.health_tokens_no_demo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_demo_user(new.user_id) then
    raise exception 'Apple Health sync needs your own account, not the demo.' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke execute on function public.health_tokens_no_demo() from public, anon, authenticated;

create trigger health_tokens_no_demo
  before insert or update on public.health_tokens
  for each row execute function public.health_tokens_no_demo();

-- 2. Storage limits for demo accounts. The seeded month is about 50 documents.
create function public.docs_demo_limits()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_demo_user(new.user_id) then return new; end if;
  if octet_length(new.data::text) > 65536 then
    raise exception 'That is too much data for the demo.' using errcode = '54000';
  end if;
  if tg_op = 'INSERT'
     and not exists (select 1 from public.docs d where d.user_id = new.user_id and d.col = new.col and d.id = new.id)
     and (select count(*) from public.docs d where d.user_id = new.user_id) >= 400 then
    raise exception 'The demo is full. Create an account to keep going.' using errcode = '54000';
  end if;
  return new;
end
$$;

revoke execute on function public.docs_demo_limits() from public, anon, authenticated;

create trigger docs_demo_limits
  before insert or update on public.docs
  for each row execute function public.docs_demo_limits();
