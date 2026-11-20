-- Run against a disposable migrated Supabase database using psql -v ON_ERROR_STOP=1.
-- Each role executes with the same JWT claims PostgREST installs in a request.
begin;
select '1..1';
create temporary table fixture as
select gen_random_uuid() as admin_id, gen_random_uuid() as member_id, gen_random_uuid() as other_id,
       null::uuid as space_id, null::text as invite, null::jsonb as published;
grant select,update on fixture to authenticated,anon,service_role;
insert into auth.users (id,email)
select admin_id,admin_id || '@example.test' from fixture union all
select member_id,member_id || '@example.test' from fixture union all
select other_id,other_id || '@example.test' from fixture;

create function pg_temp.require(value boolean, description text) returns void language plpgsql as $$
begin if value is distinct from true then raise exception 'Failed: %',description; end if; end;
$$;
create function pg_temp.must_fail(statement text,match text) returns void language plpgsql as $$
begin
  begin execute statement;
  exception when others then
    if sqlstate = match or sqlerrm = match then return; end if;
    raise;
  end;
  raise exception 'Expected rejection: %',match;
end;
$$;
create function pg_temp.login(who uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',who::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',who,'role','authenticated','is_anonymous',false)::text,true);
end;
$$;

set local role authenticated;
do $$
declare f fixture%rowtype; code text; team uuid; song jsonb; doc jsonb; rev bigint;
begin
  select * into f from fixture;
  perform pg_temp.login(f.admin_id);
  team := (public.mc_create_space('Grupo de teste')->>'id')::uuid;
  code := public.mc_invite(team);
  perform pg_temp.require(length(code)=64 and jsonb_array_length(public.mc_list_spaces())=1,'creation and invitation');
  perform pg_temp.require(public.mc_revision(team)=0,'empty space revision');
  song := '{"id":"s1","title":"Teste","artist":"","key":"C","bpm":80,"meter":"4/4","chart":"[C]Canção","notes":"","pdfId":"score1","pdfName":"Teste.pdf"}';
  doc := jsonb_build_object('version',1,'songs',jsonb_build_array(song),'plans',
    '[{"id":"p1","title":"Ensaio","date":"2026-12-01","time":"10:00","location":"","items":[{"id":"i1","title":"Teste","songId":"s1","minutes":3}],"team":[{"id":"m1","name":"Nome","role":"Voz","status":"pending"}]}]'::jsonb);
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,0,%L)',team,doc),'MC_MISSING_PDF');
  insert into storage.objects(bucket_id,name) values('musiccenter-scores',team || '/score1'),('musiccenter-scores',team || '/unpublished');
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,0,%L)',team,jsonb_set(doc,'{songs,0,notes}','"pessoal"')),'MC_INVALID_WORKSPACE');
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,0,%L)',team,jsonb_set(doc,'{plans,0,items,0,songId}','"inexistente"')),'MC_INVALID_WORKSPACE');
  rev := (public.mc_save_workspace(team,0,doc)->>'revision')::bigint;
  perform pg_temp.require(rev=1 and public.mc_workspace(team)->'workspace'=doc,'write and read');
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,0,%L)',team,doc),'MC_CONFLICT');
  perform pg_temp.require(not mc_private.score_access(team || '/score1','remove'),'published score protected');
  perform pg_temp.require(mc_private.score_access(team || '/unpublished','remove'),'unpublished score can be cleaned');
  update fixture set space_id=team, invite=code, published=doc;
end;
$$;

set local role anon;
do $$
declare f fixture%rowtype;
begin
  select * into f from fixture;
  perform pg_temp.must_fail(format('select public.mc_join_space(%L)',f.invite),'42501');
  perform pg_temp.must_fail(format('select public.mc_workspace(%L)',f.space_id),'42501');
  perform pg_temp.require(not exists(select 1 from storage.objects where bucket_id='musiccenter-scores' and name=f.space_id || '/score1'),'anonymous storage isolation');
end;
$$;

set local role authenticated;
do $$
declare f fixture%rowtype;
begin
  select * into f from fixture;
  perform pg_temp.login(f.other_id);
  perform pg_temp.require(public.mc_list_spaces()='[]','space enumeration isolated');
  perform pg_temp.require(not has_table_privilege('authenticated','mc_private.spaces','SELECT')
    and not has_table_privilege('authenticated','mc_private.invites','SELECT')
    and not has_table_privilege('authenticated','mc_private.members','INSERT')
    and not has_table_privilege('anon','mc_private.spaces','SELECT'),'no direct table grants');
  perform pg_temp.must_fail('select workspace from mc_private.spaces','42501');
  perform pg_temp.must_fail(format('select public.mc_workspace(%L)',f.space_id),'MC_FORBIDDEN');
  perform pg_temp.must_fail(format('select public.mc_revision(%L)',f.space_id),'MC_FORBIDDEN');
  perform pg_temp.require(not exists(select 1 from storage.objects where name=f.space_id || '/score1'),'unrelated account PDF isolation');
  perform pg_temp.must_fail(format('insert into storage.objects(bucket_id,name) values(%L,%L)','musiccenter-scores',f.space_id || '/other'),'42501');
  perform pg_temp.login(f.member_id);
  perform pg_temp.require(public.mc_join_space(f.invite)->>'role'='member','authenticated invitation');
  perform pg_temp.require(public.mc_list_spaces()->0->>'role'='member','persistent membership');
  perform pg_temp.require(public.mc_workspace(f.space_id)->'workspace'=f.published,'member reads shared plan');
  perform pg_temp.require(exists(select 1 from storage.objects where name=f.space_id || '/score1'),'published score visible');
  perform pg_temp.require(not exists(select 1 from storage.objects where name=f.space_id || '/unpublished'),'unpublished score hidden');
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,1,%L)',f.space_id,f.published),'MC_FORBIDDEN');
  perform pg_temp.must_fail(format('select public.mc_invite(%L)',f.space_id),'MC_FORBIDDEN');
  perform pg_temp.must_fail(format('select public.mc_members(%L)',f.space_id),'MC_FORBIDDEN');
  perform pg_temp.must_fail(format('select public.mc_prepare_account_deletion(%L)',f.admin_id),'42501');
  perform pg_temp.login(f.admin_id);
  perform public.mc_save_workspace(f.space_id,1,jsonb_set(f.published,'{plans,0,title}','"Ensaio atualizado"'));
  perform pg_temp.require(jsonb_array_length(public.mc_members(f.space_id))=2,'roster');
  perform public.mc_revoke_invites(f.space_id);
  perform pg_temp.login(f.other_id);
  perform pg_temp.must_fail(format('select public.mc_join_space(%L)',f.invite),'MC_INVALID_INVITE');
  perform pg_temp.login(f.member_id);
  perform pg_temp.require(public.mc_revision(f.space_id)=2 and public.mc_workspace(f.space_id)#>>'{workspace,plans,0,title}'='Ensaio atualizado','member receives new revision after link revoked');
  perform pg_temp.login(f.admin_id);
  perform public.mc_remove_member(f.space_id,f.member_id);
  perform pg_temp.login(f.member_id);
  perform pg_temp.must_fail(format('select public.mc_workspace(%L)',f.space_id),'MC_FORBIDDEN');
  perform pg_temp.require(not exists(select 1 from storage.objects where name=f.space_id || '/score1'),'removed member PDF isolation');
end;
$$;
set local role service_role;
do $$
declare f fixture%rowtype;
begin
  select * into f from fixture;
  perform pg_temp.require(public.mc_prepare_account_deletion(f.admin_id)=array[f.space_id],'account cleanup lists owned spaces');
end;
$$;
set local role authenticated;
do $$
declare f fixture%rowtype;
begin
  select * into f from fixture;
  perform pg_temp.login(f.admin_id);
  perform pg_temp.must_fail(format('select public.mc_save_workspace(%L,2,%L)',f.space_id,f.published),'MC_FORBIDDEN');
  perform pg_temp.must_fail('select public.mc_create_space(''Outro'')','MC_FORBIDDEN');
end;
$$;
rollback;
select 'ok 1 - accounts, spaces, invitations, RLS, revision conflicts, PDFs and account cleanup';
