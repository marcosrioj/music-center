-- Personal annotations have independent authorization and concurrency control.
-- Shared workspace snapshots always carry an empty "notes" field.
create table public.personal_notes (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  song_id text not null check (song_id ~ '^[A-Za-z0-9_-]{1,128}$'),
  note text not null check (octet_length(note) between 1 and 65536),
  primary key (space_id,user_id,song_id)
);
create index personal_notes_by_user on public.personal_notes(user_id);
alter table public.personal_notes enable row level security;
revoke all on public.personal_notes from public,anon,authenticated;

-- A deleted song also deletes the corresponding annotations. A later song
-- recreated with the same local ID must start with its own notes.
create function mc_private.prune_removed_notes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare ids jsonb;
begin
  select coalesce(jsonb_object_agg(song->>'id',true),'{}') into ids from jsonb_array_elements(new.workspace->'songs') song;
  delete from public.personal_notes n where n.space_id=new.id and not ids ? n.song_id;
  return new;
end;
$$;
revoke all on function mc_private.prune_removed_notes() from public,anon,authenticated;
create trigger mc_prune_removed_notes after update of workspace on public.spaces
for each row when ((old.workspace->'songs') is distinct from (new.workspace->'songs'))
execute function mc_private.prune_removed_notes();

create function public.mc_notes(p_space uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare actor uuid := mc_private.actor();
begin
  perform 1 from public.spaces s where s.id=p_space and not s.deleting and (s.owner_id=actor
    or exists(select 1 from public.members m where m.space_id=s.id and m.user_id=actor));
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  return (select coalesce(jsonb_object_agg(n.song_id,n.note),'{}') from public.personal_notes n
    where n.space_id=p_space and n.user_id=actor);
end;
$$;

create function public.mc_save_note(p_space uuid,p_song text,p_note text,p_previous text) returns void
language plpgsql security definer set search_path = '' as $$
declare actor uuid := mc_private.actor(); s public.spaces%rowtype; old_note text;
begin
  select * into s from public.spaces where id=p_space and not deleting for update;
  if not found or actor is null or (s.owner_id<>actor and not exists(
    select 1 from public.members m where m.space_id=p_space and m.user_id=actor))
  then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if p_song is null or p_song !~ '^[A-Za-z0-9_-]{1,128}$' or p_note is null or octet_length(p_note)>65536 then
    raise exception 'MC_NOTE_LIMIT';
  end if;
  if not (s.workspace->'songs') @> jsonb_build_array(jsonb_build_object('id',p_song)) then raise exception 'MC_SONG_MISSING'; end if;
  select note into old_note from public.personal_notes where space_id=p_space and user_id=actor and song_id=p_song;
  if coalesce(old_note,'') is distinct from coalesce(p_previous,'') then raise exception 'MC_CONFLICT' using errcode='PT409'; end if;
  if p_note='' then
    delete from public.personal_notes where space_id=p_space and user_id=actor and song_id=p_song;
  else
    if (select coalesce(sum(octet_length(note)),0) from public.personal_notes
      where space_id=p_space and user_id=actor and song_id<>p_song) + octet_length(p_note)>2097152
    then raise exception 'MC_NOTE_LIMIT'; end if;
    insert into public.personal_notes(space_id,user_id,song_id,note) values(p_space,actor,p_song,p_note)
    on conflict(space_id,user_id,song_id) do update set note=excluded.note;
  end if;
end;
$$;

create function public.mc_import_workspace(p_space uuid,p_revision bigint,p_workspace jsonb,p_notes jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare actor uuid := mc_private.actor(); s public.spaces%rowtype; ids jsonb; result jsonb;
begin
  select * into s from public.spaces where id=p_space and owner_id=actor and not deleting for update;
  if not found then raise exception 'MC_FORBIDDEN' using errcode='42501'; end if;
  if s.revision is distinct from p_revision then raise exception 'MC_CONFLICT' using errcode='PT409'; end if;
  if jsonb_array_length(s.workspace->'songs')>0 or jsonb_array_length(s.workspace->'plans')>0 then raise exception 'MC_NOT_EMPTY'; end if;
  if jsonb_typeof(p_notes) is distinct from 'object' or octet_length(p_notes::text)>8388608 then raise exception 'MC_NOTE_LIMIT'; end if;
  -- Every mutation below is in this RPC transaction: a rejected annotation
  -- rolls back the snapshot, its revision and every inserted note.
  result := public.mc_save_workspace(p_space,p_revision,p_workspace);
  select coalesce(jsonb_object_agg(song->>'id',true),'{}') into ids from jsonb_array_elements(p_workspace->'songs') song;
  if exists(select 1 from jsonb_each(p_notes) n where jsonb_typeof(n.value)<>'string' or not ids ? n.key
    or octet_length(n.value #>> '{}')>65536)
    or (select coalesce(sum(octet_length(value)),0) from jsonb_each_text(p_notes))>2097152
  then raise exception 'MC_INVALID_NOTES'; end if;
  insert into public.personal_notes(space_id,user_id,song_id,note)
    select p_space,actor,key,value from jsonb_each_text(p_notes) where value<>'';
  return result;
end;
$$;
revoke all on function public.mc_notes(uuid),public.mc_save_note(uuid,text,text,text),
  public.mc_import_workspace(uuid,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.mc_notes(uuid),public.mc_save_note(uuid,text,text,text),
  public.mc_import_workspace(uuid,bigint,jsonb,jsonb) to authenticated;
