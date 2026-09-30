// Reproducible local SQL regression. Install PGlite outside the repo, then run:
//   npm install --prefix /tmp/vji-learning-hub-pglite --no-package-lock --no-save @electric-sql/pglite@0.5.8
//   PGLITE_NODE_MODULES=/tmp/vji-learning-hub-pglite/node_modules node supabase/tests/learning_hub.pglite.mjs
// The runner extracts note_ords and sync_note_cards from the real application migration.
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const externalModules = process.env.PGLITE_NODE_MODULES;
const loadPgliteModule = (relativePath, packageName) => externalModules
  ? import(pathToFileURL(resolve(externalModules, relativePath)).href)
  : import(packageName);

const [{ PGlite }, { pgcrypto }] = await Promise.all([
  loadPgliteModule("@electric-sql/pglite/dist/index.js", "@electric-sql/pglite"),
  loadPgliteModule("@electric-sql/pglite/dist/contrib/pgcrypto.js", "@electric-sql/pglite/contrib/pgcrypto"),
]);

const bootstrap = `
create role anon nologin;
create role authenticated nologin;
create schema auth;
create schema private;
create schema extensions;
create table auth.users (id uuid primary key, email text unique);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nickname text not null default '学习者'
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
create function private.test_new_auth_user() returns trigger language plpgsql as $$
begin
  insert into public.profiles(id) values (new.id);
  return new;
end;
$$;
create trigger test_new_auth_user after insert on auth.users
  for each row execute function private.test_new_auth_user();
create type public.note_type as enum ('note', 'qa', 'choice', 'cloze', 'poem', 'vocab');
create table public.decks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  type public.note_type not null,
  fields jsonb not null default '{}'::jsonb,
  tags text[] not null default '{}',
  layout text not null default 'minimal',
  source jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.cards (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  deck_id uuid not null references public.decks(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  ord integer not null default 0,
  due timestamptz not null default now(),
  stability double precision not null default 0,
  difficulty double precision not null default 0,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  learning_steps integer not null default 0,
  reps integer not null default 0,
  lapses integer not null default 0,
  state integer not null default 0,
  last_review timestamptz,
  starred boolean not null default false,
  suspended boolean not null default false,
  created_at timestamptz not null default now(),
  unique(note_id, ord)
);
create table public.review_logs (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  rating integer not null,
  state integer not null,
  due timestamptz not null,
  stability double precision,
  difficulty double precision,
  elapsed_days integer not null default 0,
  scheduled_days integer not null default 0,
  review_at timestamptz not null default now(),
  duration_ms integer not null default 0
);
create function private.test_sync_card_deck() returns trigger language plpgsql as $$
begin
  update public.cards set deck_id = new.deck_id where note_id = new.id and owner_id = new.owner_id;
  return new;
end;
$$;
create trigger test_sync_card_deck after update of deck_id on public.notes
  for each row when (old.deck_id is distinct from new.deck_id)
  execute function private.test_sync_card_deck();
`;

function extractFunction(sql, name) {
  const escapedName = name.replaceAll(".", "\\.");
  const match = sql.match(new RegExp(`create or replace function ${escapedName}\\([\\s\\S]*?\\n\\$\\$;`, "i"));
  if (!match) throw new Error(`Could not find ${name} in the application migration`);
  return match[0];
}

export async function initializeLearningHubTestDb() {
  const pg = new PGlite({ extensions: { pgcrypto } });
  try {
    await pg.exec(bootstrap);

    const appMigration = await readFile(resolve(repoRoot, "supabase/migrations/20260915015435_ai_cards.sql"), "utf8");
    const realNoteOrdFunctions = [
      extractFunction(appMigration, "private.note_ords"),
      extractFunction(appMigration, "private.sync_note_cards"),
    ].join("\n\n");
    await pg.exec(realNoteOrdFunctions);

    const migration = await readFile(resolve(repoRoot, "supabase/migrations/20260929090000_learning_hub.sql"), "utf8");
    await pg.exec(migration);
    const readFrogEnum = await readFile(resolve(repoRoot, "supabase/migrations/20260930100000_read_frog_cards.sql"), "utf8");
    const readFrogValidation = await readFile(resolve(repoRoot, "supabase/migrations/20260930100100_read_frog_card_validation.sql"), "utf8");
    const readFrogSync = await readFile(resolve(repoRoot, "supabase/migrations/20260930100200_read_frog_learning_hub_sync.sql"), "utf8");
    await pg.exec(readFrogEnum);
    await pg.exec(readFrogValidation);
    await pg.exec(readFrogSync);
    return pg;
  } catch (error) {
    await pg.close();
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let pg;
  try {
    pg = await initializeLearningHubTestDb();
    const regression = await readFile(resolve(repoRoot, "supabase/tests/learning_hub.sql"), "utf8");
    await pg.exec(regression);
    console.log("PGlite migration apply + real card functions + learning_hub.sql regression: PASS");
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await pg?.close();
  }
}
