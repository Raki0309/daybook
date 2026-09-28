-- Apple Health steps via an iPhone Shortcut.
-- The app creates a personal token; the Shortcut posts it with the step lines
-- ("yyyy-MM-dd 8123", one per day) to /rest/v1/rpc/ingest_health.
-- Only a SHA-256 hash of the token is stored.

create table public.health_tokens (
  user_id    uuid        primary key references auth.users (id) on delete cascade,
  token_hash text        not null unique,
  created_at timestamptz not null default now(),
  last_used  timestamptz
);

alter table public.health_tokens enable row level security;
create policy "own token: read" on public.health_tokens for select to authenticated using (user_id = (select auth.uid()));

create function public.create_health_token()
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
  insert into public.health_tokens (user_id, token_hash)
  values (v_uid, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'))
  on conflict (user_id) do update set token_hash = excluded.token_hash, created_at = now(), last_used = null;
  return v_token;
end
$$;

revoke execute on function public.create_health_token() from public, anon;
grant execute on function public.create_health_token() to authenticated;

-- Parses one step line into (date, steps). Returns nothing for lines it can't read.
create function public.parse_step_line(p_line text)
returns table (day date, steps integer)
language plpgsql
immutable
set search_path = ''
as $$
declare
  m text[];
  rest text;
  num text;
begin
  m := regexp_match(p_line, '(\d{4})-(\d{1,2})-(\d{1,2})');
  if m is not null then
    begin
      day := make_date(m[1]::int, m[2]::int, m[3]::int);
    exception when others then return;
    end;
  else
    m := regexp_match(p_line, '(\d{1,2})[./](\d{1,2})[./](\d{4})');
    if m is null then return; end if;
    begin
      day := make_date(m[3]::int, m[2]::int, m[1]::int);
    exception when others then return;
    end;
  end if;
  rest := replace(p_line, array_to_string(regexp_match(p_line, '\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[./]\d{1,2}[./]\d{4}'), ''), ' ');
  rest := regexp_replace(rest, '\m\d{1,2}:\d{2}(:\d{2})?\M', ' ', 'g');
  num := (regexp_match(rest, '\d[\d.,'' ]*'))[1];
  if num is null then return; end if;
  num := regexp_replace(btrim(num), '[.,]\d{1,2}$', '');
  num := regexp_replace(num, '\D', '', 'g');
  if num = '' or length(num) > 7 then return; end if;
  steps := num::int;
  if steps > 200000 then return; end if;
  return next;
end
$$;

create function public.ingest_health(p_token text, p_text text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid;
  v_at bigint := (extract(epoch from now()) * 1000)::bigint;
  r record;
  n int := 0;
  v_first date;
  v_last date;
begin
  select user_id into v_uid from public.health_tokens
   where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  if v_uid is null then raise exception 'Unknown token. Create a new one in Daybook settings.'; end if;
  if length(coalesce(p_text, '')) > 20000 then raise exception 'Too much text. Send at most a few months at once.'; end if;

  for r in
    select p.day, sum(p.steps)::int as steps
      from regexp_split_to_table(p_text, E'\r?\n|;') as l(line)
      cross join lateral public.parse_step_line(l.line) as p
     where p.day <= current_date + 1 and p.day > current_date - 800
     group by p.day
  loop
    insert into public.docs as d (user_id, col, id, data)
    values (v_uid, 'stepsm', to_char(r.day, 'YYYY-MM'),
            jsonb_build_object('items', jsonb_build_object(r.day::text,
              jsonb_build_object('id', r.day::text, 'date', r.day::text, 'n', least(r.steps, 200000), 'src', 'health', 'at', v_at))))
    on conflict (user_id, col, id) do update
      set data = case when d.deleted then excluded.data else public.jsonb_merge1(d.data, excluded.data) end,
          deleted = false, updated_at = now();
    n := n + 1;
    v_first := least(coalesce(v_first, r.day), r.day);
    v_last := greatest(coalesce(v_last, r.day), r.day);
  end loop;

  update public.health_tokens set last_used = now() where user_id = v_uid;
  return jsonb_build_object('days', n, 'from', v_first, 'to', v_last);
end
$$;

revoke execute on function public.ingest_health(text, text) from public;
grant execute on function public.ingest_health(text, text) to anon, authenticated;
