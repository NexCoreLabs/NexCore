-- NexCore AI Knowledge Cleanup (Supabase SQL Editor)
-- Purpose:
-- 1) Keep AI knowledge focused on NexCore/project data only
-- 2) Remove duplicated rows
-- 3) Add lightweight integrity/performance guardrails
--
-- Run this in Supabase SQL Editor.

begin;

-- 0) Normalize source values
update public.ai_knowledge
set source = lower(trim(source))
where source is not null;

-- 1) Remove non-NexCore sources (for this phase: keep only nexcore + project)
delete from public.ai_knowledge
where source is null
   or source not in ('nexcore', 'project');

-- 2) Remove exact logical duplicates (same normalized source/title/content)
with ranked as (
  select
    id,
    row_number() over (
      partition by
        lower(trim(source)),
        lower(trim(title)),
        lower(trim(content))
      order by created_at asc, id asc
    ) as rn
  from public.ai_knowledge
)
delete from public.ai_knowledge k
using ranked r
where k.id = r.id
  and r.rn > 1;

-- 3) Add a source check (idempotent)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'ai_knowledge_source_check'
  ) then
    alter table public.ai_knowledge
      add constraint ai_knowledge_source_check
      check (source in ('nexcore', 'project'));
  end if;
end $$;

-- 4) Helpful indexes
create index if not exists ai_knowledge_source_idx
  on public.ai_knowledge (source);

create index if not exists ai_knowledge_created_at_idx
  on public.ai_knowledge (created_at desc);

-- 5) Prevent future duplicates on normalized logical key
create unique index if not exists ai_knowledge_unique_logical_idx
  on public.ai_knowledge (
    lower(trim(source)),
    md5(lower(trim(title))),
    md5(lower(trim(content)))
  );

commit;

-- Optional inspection queries:
-- select source, count(*) from public.ai_knowledge group by source order by source;
-- select count(*) as rows_with_null_embedding from public.ai_knowledge where embedding is null;
