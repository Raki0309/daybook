-- Daybook storage: one row per document, owned by the signed-in user.
-- A document path "col/id" maps to (col, id). Month and week buckets keep an
-- "items" map, exactly as the app stored them before.

create table public.docs (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  col        text        not null,
  id         text        not null,
  data       jsonb       not null default '{}'::jsonb,
  deleted    boolean     not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, col, id)
);

alter table public.docs enable row level security;

create policy "own docs: read"   on public.docs for select to authenticated using (user_id = (select auth.uid()));
create policy "own docs: insert" on public.docs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "own docs: update" on public.docs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "own docs: delete" on public.docs for delete to authenticated using (user_id = (select auth.uid()));

-- Live sync between devices. Deletes are soft (deleted = true) so every change
-- arrives as an update that row level security can filter per user.
alter publication supabase_realtime add table public.docs;

-- One level deep merge: object values merge key by key, anything else replaces.
create function public.jsonb_merge1(a jsonb, b jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(a, '{}'::jsonb) || coalesce((
    select jsonb_object_agg(
      e.key,
      case when jsonb_typeof(a -> e.key) = 'object' and jsonb_typeof(e.value) = 'object'
           then (a -> e.key) || e.value
           else e.value end)
    from jsonb_each(b) as e
  ), '{}'::jsonb)
$$;

-- Merge a patch into a document, creating it if needed.
create function public.doc_merge(p_col text, p_id text, p_patch jsonb)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.docs as d (user_id, col, id, data)
  values ((select auth.uid()), p_col, p_id, p_patch)
  on conflict (user_id, col, id) do update
    set data = case when d.deleted then excluded.data else public.jsonb_merge1(d.data, excluded.data) end,
        deleted = false,
        updated_at = now();
$$;

revoke execute on function public.doc_merge(text, text, jsonb) from public, anon;
grant execute on function public.doc_merge(text, text, jsonb) to authenticated;
