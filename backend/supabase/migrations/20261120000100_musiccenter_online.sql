-- The Data API exposes only the public RPCs. Workspace snapshots and memberships
-- live outside the exposed schemas, with RLS and no direct client table grants.
create schema mc_private;
revoke all on schema mc_private from public, anon, authenticated;
grant usage on schema mc_private to authenticated;

create table mc_private.spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  revision bigint not null default 0,
  workspace jsonb not null default '{"version":1,"plans":[],"songs":[]}',
  deleting boolean not null default false,
  created_at timestamptz not null default now()
);
create index spaces_by_owner on mc_private.spaces(owner_id, created_at);
create table mc_private.members (
  space_id uuid not null references mc_private.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (space_id,user_id)
);
create index members_by_user on mc_private.members(user_id,space_id);
create table mc_private.invites (
  digest bytea primary key,
  sequence_number bigint generated always as identity,
  space_id uuid not null references mc_private.spaces(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index invites_by_space on mc_private.invites(space_id);
create table mc_private.rejoin_cutoffs (
  space_id uuid not null references mc_private.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  last_invitation bigint not null,
  primary key(space_id,user_id)
);
create index rejoin_cutoffs_by_user on mc_private.rejoin_cutoffs(user_id);
create table mc_private.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table mc_private.spaces enable row level security;
alter table mc_private.members enable row level security;
alter table mc_private.invites enable row level security;
alter table mc_private.rejoin_cutoffs enable row level security;
alter table mc_private.account_deletions enable row level security;
revoke all on all tables in schema mc_private from public, anon, authenticated;

create function mc_private.actor() returns uuid language sql stable
set search_path = '' as $$
  select auth.uid() where coalesce(auth.jwt()->>'is_anonymous','false') <> 'true'
    and not exists(select 1 from mc_private.account_deletions where user_id = auth.uid());
$$;

create function mc_private.valid_id(val jsonb) returns boolean language sql immutable
set search_path = '' as $$
  select coalesce(jsonb_typeof(val) = 'string' and (val #>> '{}') ~ '^[A-Za-z0-9_-]{1,128}$',false);
$$;

create function mc_private.valid_text(val jsonb, maximum integer, required boolean default false)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(jsonb_typeof(val) = 'string'
    and char_length(val #>> '{}') <= maximum
    and (not required or btrim(val #>> '{}') <> ''),false);
$$;

create function mc_private.valid_integer(val jsonb, low integer, high integer) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(val) = 'number'
    then (val::numeric between low and high and val::numeric = trunc(val::numeric))
    else false end;
$$;

create function mc_private.valid_array(val jsonb, maximum integer) returns boolean
language sql immutable set search_path = '' as $$
  select case when jsonb_typeof(val) = 'array' then jsonb_array_length(val) <= maximum else false end;
$$;

create function mc_private.unique_ids(entries jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select count(*) = count(distinct element->>'id')
  from jsonb_array_elements(entries) element;
$$;

create function mc_private.validate_workspace(doc jsonb) returns void
language plpgsql set search_path = '' as $$
declare song jsonb; plan jsonb; item jsonb; person jsonb; ids jsonb;
begin
  if jsonb_typeof(doc) is distinct from 'object' or octet_length(doc::text) > 8388608
    or (doc - array['version','plans','songs']) <> '{}'
    or doc->'version' is distinct from '1'::jsonb
    or not mc_private.valid_array(doc->'plans',1000) or not mc_private.valid_array(doc->'songs',1000)
  then raise exception 'MC_INVALID_WORKSPACE'; end if;
  if not mc_private.unique_ids(doc->'plans') or not mc_private.unique_ids(doc->'songs')
  then raise exception 'MC_INVALID_WORKSPACE'; end if;

  for song in select value from jsonb_array_elements(doc->'songs') loop
    if jsonb_typeof(song) <> 'object'
      or (song - array['id','title','artist','key','bpm','meter','chart','notes','pdfId','pdfName']) <> '{}'
      or not mc_private.valid_id(song->'id')
      or not mc_private.valid_text(song->'title',1024,true)
      or not mc_private.valid_text(song->'artist',1024)
      or not mc_private.valid_text(song->'key',12,true)
      or not mc_private.valid_integer(song->'bpm',30,300)
      or not mc_private.valid_text(song->'meter',12,true)
      or not mc_private.valid_text(song->'chart',1048576)
      or song->'notes' is distinct from '""'::jsonb
      or (song ? 'pdfId' and not mc_private.valid_id(song->'pdfId'))
      or (song ? 'pdfName' and (not song ? 'pdfId' or not mc_private.valid_text(song->'pdfName',1024,true)))
    then raise exception 'MC_INVALID_WORKSPACE'; end if;
  end loop;
  select coalesce(jsonb_object_agg(value->>'id',true),'{}') into ids from jsonb_array_elements(doc->'songs');

  for plan in select value from jsonb_array_elements(doc->'plans') loop
    if jsonb_typeof(plan) <> 'object'
      or (plan - array['id','title','date','time','location','items','team']) <> '{}'
      or not mc_private.valid_id(plan->'id')
      or not mc_private.valid_text(plan->'title',1024,true)
      or not mc_private.valid_text(plan->'location',1024)
      or not mc_private.valid_text(plan->'date',10,true) or (plan->>'date') !~ '^\d{4}-\d{2}-\d{2}$'
      or not mc_private.valid_text(plan->'time',5,true) or (plan->>'time') !~ '^([01]\d|2[0-3]):[0-5]\d$'
      or not mc_private.valid_array(plan->'items',1000) or not mc_private.valid_array(plan->'team',1000)
    then raise exception 'MC_INVALID_WORKSPACE'; end if;
    perform (plan->>'date')::date;
    if not mc_private.unique_ids(plan->'items') or not mc_private.unique_ids(plan->'team')
    then raise exception 'MC_INVALID_WORKSPACE'; end if;
    for item in select value from jsonb_array_elements(plan->'items') loop
      if jsonb_typeof(item) <> 'object'
        or (item - array['id','songId','title','minutes']) <> '{}'
        or not mc_private.valid_id(item->'id') or not mc_private.valid_text(item->'title',1024,true)
        or not mc_private.valid_integer(item->'minutes',0,1440)
        or (item ? 'songId' and (not mc_private.valid_id(item->'songId') or not ids ? (item->>'songId')))
      then raise exception 'MC_INVALID_WORKSPACE'; end if;
    end loop;
    for person in select value from jsonb_array_elements(plan->'team') loop
      if jsonb_typeof(person) <> 'object'
        or (person - array['id','name','role','status']) <> '{}'
        or not mc_private.valid_id(person->'id') or not mc_private.valid_text(person->'name',1024,true)
        or not mc_private.valid_text(person->'role',1024,true) or not mc_private.valid_text(person->'status',10,true)
        or person->>'status' not in ('confirmed','pending','declined')
      then raise exception 'MC_INVALID_WORKSPACE'; end if;
    end loop;
  end loop;
exception when datetime_field_overflow or invalid_datetime_format then raise exception 'MC_INVALID_WORKSPACE';
end;
$$;

create function public.mc_create_space(p_name text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := mc_private.actor(); new_id uuid;
begin
  if actor is null then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if p_name is null or char_length(btrim(p_name)) not between 1 and 120 then raise exception 'MC_INVALID_NAME'; end if;
  -- Serialize the per-account quota and the beginning of account deletion.
  perform 1 from auth.users where id = actor for update;
  if not found or mc_private.actor() is null then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if (select count(*) from mc_private.spaces where owner_id = actor) >= 32 then raise exception 'MC_SPACE_LIMIT'; end if;
  insert into mc_private.spaces(owner_id,name) values(actor,btrim(p_name)) returning id into new_id;
  return jsonb_build_object('id',new_id,'name',btrim(p_name),'role','admin');
end;
$$;

create function public.mc_list_spaces() returns jsonb language sql stable security definer
set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'role',
    case when s.owner_id = mc_private.actor() then 'admin' else 'member' end) order by s.created_at,s.id),'[]')
  from mc_private.spaces s where not s.deleting and
    (s.owner_id = mc_private.actor() or exists(select 1 from mc_private.members m
      where m.space_id = s.id and m.user_id = mc_private.actor()));
$$;

create function public.mc_workspace(p_space uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  select jsonb_build_object('revision',s.revision,'workspace',s.workspace) into result
  from mc_private.spaces s where id = p_space and not deleting and (s.owner_id = mc_private.actor()
    or exists(select 1 from mc_private.members m where m.space_id = s.id and m.user_id = mc_private.actor()));
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  return result;
end;
$$;

create function public.mc_save_workspace(p_space uuid,p_revision bigint,p_workspace jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare current_revision bigint;
begin
  select revision into current_revision from mc_private.spaces
  where id = p_space and owner_id = mc_private.actor() and not deleting for update;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if current_revision is distinct from p_revision then raise exception 'MC_CONFLICT' using errcode='PT409'; end if;
  perform mc_private.validate_workspace(p_workspace);
  if exists(select 1 from jsonb_array_elements(p_workspace->'songs') song where song ? 'pdfId'
    and not exists(select 1 from storage.objects obj where obj.bucket_id = 'musiccenter-scores'
      and obj.name = p_space::text || '/' || (song->>'pdfId')))
  then raise exception 'MC_MISSING_PDF'; end if;
  update mc_private.spaces set revision = current_revision + 1, workspace = p_workspace where id = p_space;
  return jsonb_build_object('revision',current_revision + 1,'workspace',p_workspace);
end;
$$;

create function public.mc_revision(p_space uuid) returns bigint
language plpgsql stable security definer set search_path = '' as $$
declare current_revision bigint;
begin
  select s.revision into current_revision from mc_private.spaces s where s.id = p_space and not s.deleting
    and (s.owner_id = mc_private.actor() or exists(select 1 from mc_private.members m
      where m.space_id = s.id and m.user_id = mc_private.actor()));
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  return current_revision;
end;
$$;

create function public.mc_invite(p_space uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare token text;
begin
  perform 1 from mc_private.spaces where id = p_space and owner_id = mc_private.actor() and not deleting for update;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if (select count(*) from mc_private.invites where space_id = p_space) >= 100 then raise exception 'MC_INVITE_LIMIT'; end if;
  -- Two independent CSPRNG-backed v4 UUIDs carry 244 random bits.
  token := encode(sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text,'UTF8')),'hex');
  insert into mc_private.invites(digest,space_id) values(sha256(convert_to(token,'UTF8')),p_space);
  return token;
end;
$$;

create function public.mc_revoke_invites(p_space uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from mc_private.spaces where id = p_space and owner_id = mc_private.actor() and not deleting for update;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  delete from mc_private.invites where space_id = p_space;
end;
$$;

create function public.mc_join_space(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := mc_private.actor(); code bytea; invite_order bigint; s mc_private.spaces%rowtype;
begin
  if actor is null then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if p_token is null or p_token !~ '^[a-f0-9]{64}$' then raise exception 'MC_INVALID_INVITE'; end if;
  code := sha256(convert_to(p_token,'UTF8'));
  -- Lock in the same order as invitations/revocation. Recheck the invitation after
  -- acquiring the lock in case a concurrent revoke committed while we waited.
  select sp.* into s from mc_private.spaces sp join mc_private.invites i on sp.id=i.space_id
    where i.digest=code and not sp.deleting for update of sp;
  if not found then raise exception 'MC_INVALID_INVITE'; end if;
  select sequence_number into invite_order from mc_private.invites where digest=code;
  if not found or exists(select 1 from mc_private.rejoin_cutoffs
    where space_id=s.id and user_id=actor and last_invitation >= invite_order)
  then raise exception 'MC_INVALID_INVITE'; end if;
  if actor <> s.owner_id and not exists(select 1 from mc_private.members where space_id=s.id and user_id=actor) then
    if (select count(*) from mc_private.members where space_id=s.id) >= 1000 then raise exception 'MC_MEMBER_LIMIT'; end if;
    insert into mc_private.members(space_id,user_id) values(s.id,actor);
    delete from mc_private.rejoin_cutoffs where space_id=s.id and user_id=actor;
  end if;
  return jsonb_build_object('id',s.id,'name',s.name,'role',case when actor=s.owner_id then 'admin' else 'member' end);
end;
$$;

create function public.mc_members(p_space uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare owner uuid;
begin
  select owner_id into owner from mc_private.spaces where id=p_space and owner_id=mc_private.actor() and not deleting;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  return (select jsonb_agg(jsonb_build_object('id',u.id,'email',u.email,'role',
    case when u.id=owner then 'admin' else 'member' end) order by (u.id=owner) desc,u.email,u.id)
    from auth.users u where u.id=owner or u.id in (select user_id from mc_private.members where space_id=p_space));
end;
$$;

create function public.mc_remove_member(p_space uuid,p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare owner uuid;
begin
  select owner_id into owner from mc_private.spaces where id=p_space and owner_id=mc_private.actor() and not deleting for update;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if p_user=owner then raise exception 'MC_OWNER'; end if;
  delete from mc_private.members where space_id=p_space and user_id=p_user;
  if found then
    -- Existing links remain usable by the rest of the group. This user needs
    -- a link generated after removal to regain access.
    insert into mc_private.rejoin_cutoffs(space_id,user_id,last_invitation)
    select p_space,p_user,max(sequence_number) from mc_private.invites
    where space_id=p_space having count(*) > 0
    on conflict(space_id,user_id) do update set last_invitation=excluded.last_invitation;
  end if;
end;
$$;

create function public.mc_prepare_account_deletion(p_user uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from auth.users where id=p_user for update;
  if not found then raise exception 'MC_UNKNOWN_ACCOUNT'; end if;
  insert into mc_private.account_deletions(user_id) values(p_user) on conflict do nothing;
  update mc_private.spaces set deleting=true where owner_id=p_user;
  return array(select id from mc_private.spaces where owner_id=p_user order by id);
end;
$$;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('musiccenter-scores','musiccenter-scores',false,52428800,array['application/pdf']);

-- Paths are exactly "<space UUID>/<score ID>". Uploads use upsert=false. The
-- short row lock serializes upload/delete authorization with publishing a score
-- and suspending a space for account deletion.
create function mc_private.score_access(object_name text, action text) returns boolean
language plpgsql volatile security definer set search_path = '' as $$
declare space_uuid uuid; pdf_id text; s mc_private.spaces%rowtype; actor uuid := mc_private.actor();
begin
  if actor is null or object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,128}$'
  then return false; end if;
  space_uuid := split_part(object_name,'/',1)::uuid;
  pdf_id := split_part(object_name,'/',2);
  if action = 'read' then
    select * into s from mc_private.spaces where id=space_uuid and not deleting;
    if not found then return false; end if;
    if s.owner_id=actor then return true; end if;
    return exists(select 1 from mc_private.members where space_id=s.id and user_id=actor)
      and (s.workspace->'songs') @> jsonb_build_array(jsonb_build_object('pdfId',pdf_id));
  end if;
  select * into s from mc_private.spaces where id=space_uuid and owner_id=actor and not deleting for update;
  if not found then return false; end if;
  if action = 'add' then
    return (select count(*) from storage.objects where bucket_id='musiccenter-scores'
      and name like space_uuid::text || '/%') < 1200;
  end if;
  if action = 'remove' then
    return not (s.workspace->'songs') @> jsonb_build_array(jsonb_build_object('pdfId',pdf_id));
  end if;
  return false;
end;
$$;
revoke all on all functions in schema mc_private from public,anon,authenticated;
grant execute on function mc_private.score_access(text,text) to authenticated;
create policy mc_read_scores on storage.objects for select to authenticated
using (bucket_id='musiccenter-scores' and mc_private.score_access(name,'read'));
create policy mc_upload_scores on storage.objects for insert to authenticated
with check (bucket_id='musiccenter-scores' and mc_private.score_access(name,'add'));
create policy mc_remove_scores on storage.objects for delete to authenticated
using (bucket_id='musiccenter-scores' and mc_private.score_access(name,'remove'));

-- Supabase may grant default function privileges to anon and authenticated.
-- Restrict only this application's RPCs and preserve other public-schema APIs.
do $$
declare signature regprocedure;
begin
  foreach signature in array array[
    'public.mc_create_space(text)'::regprocedure, 'public.mc_list_spaces()'::regprocedure,
    'public.mc_workspace(uuid)'::regprocedure,'public.mc_revision(uuid)'::regprocedure,
    'public.mc_save_workspace(uuid,bigint,jsonb)'::regprocedure,'public.mc_invite(uuid)'::regprocedure,
    'public.mc_revoke_invites(uuid)'::regprocedure,'public.mc_join_space(text)'::regprocedure,
    'public.mc_members(uuid)'::regprocedure,'public.mc_remove_member(uuid,uuid)'::regprocedure
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated, service_role',signature);
    execute format('grant execute on function %s to authenticated',signature);
  end loop;
end;
$$;
revoke all on function public.mc_prepare_account_deletion(uuid) from public,anon,authenticated,service_role;
grant execute on function public.mc_prepare_account_deletion(uuid) to service_role;
