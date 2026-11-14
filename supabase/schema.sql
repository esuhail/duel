-- Duel global leaderboard. Paste into Supabase: SQL Editor -> New query -> Run.
-- Safe to re-run.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  game text not null check (game in ('reaction', 'math', 'targets', 'anagrams', 'memory')),
  name text not null check (char_length(name) between 1 and 12),
  score integer not null,
  created_at timestamptz not null default now()
);
create index if not exists scores_game_score on public.scores (game, score);
create index if not exists scores_name_time on public.scores (lower(name), created_at);

-- Row level security: anyone may read; nobody may write directly.
alter table public.scores enable row level security;
drop policy if exists "anyone can read scores" on public.scores;
create policy "anyone can read scores" on public.scores for select using (true);

-- One row per player per game: their best (lower is better for reaction/targets).
create or replace view public.leaderboard with (security_invoker = true) as
select game, name, score, created_at
from (
  select *, row_number() over (
    partition by game, lower(name)
    order by case when game in ('reaction', 'targets') then score else -score end, created_at
  ) as rn
  from public.scores
) best
where rn = 1;

-- The only way to write: rejects impossible scores and floods.
create or replace function public.submit_score(p_game text, p_name text, p_score integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text := btrim(p_name);
begin
  if clean_name is null or char_length(clean_name) not between 1 and 12 then
    raise exception 'bad name';
  end if;
  -- Plausibility limits: what a human can actually score in each game.
  if (p_game = 'reaction' and p_score not between 100 and 1000)
    or (p_game = 'math' and p_score not between 1 and 80)
    or (p_game = 'targets' and p_score not between 2500 and 45000)
    or (p_game = 'anagrams' and p_score not between 100 and 60000)
    or (p_game = 'memory' and p_score not between 1 and 30)
    or p_game not in ('reaction', 'math', 'targets', 'anagrams', 'memory') then
    raise exception 'implausible score';
  end if;
  -- Rate limits: per name, and overall.
  if (select count(*) from scores where lower(name) = lower(clean_name) and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'slow down';
  end if;
  if (select count(*) from scores where created_at > now() - interval '1 minute') >= 300 then
    raise exception 'busy';
  end if;
  insert into scores (game, name, score) values (p_game, clean_name, p_score);
end;
$$;

revoke all on function public.submit_score(text, text, integer) from public;
grant execute on function public.submit_score(text, text, integer) to anon;
grant select on public.leaderboard to anon;
