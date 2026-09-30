// PGLITE_NODE_MODULES=/tmp/vji-learning-hub-pglite/node_modules node supabase/tests/agent_decks.pglite.mjs
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeLearningHubTestDb } from "./learning_hub.pglite.mjs";

const pg = await initializeLearningHubTestDb();
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const tokenA = "a".repeat(64);
const tokenB = "b".repeat(64);
try {
  await pg.exec(`
    create role service_role nologin;
    create function auth.role() returns text language sql stable as $$
      select current_setting('request.jwt.claim.role', true);
    $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
  `);
  for (const file of [
    "20260928040000_agent_card_api.sql",
    "20260930030000_agent_deck_discovery.sql",
  ]) {
    await pg.exec(
      await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8"),
    );
  }
  await pg.exec(`
    insert into auth.users(id,email) values ('${a}','a@test.local'),('${b}','b@test.local');
    insert into public.decks(id,owner_id,name) values
      ('11111111-1111-4111-8111-111111111101','${a}','A empty'),
      ('11111111-1111-4111-8111-111111111102','${a}','A second'),
      ('22222222-2222-4222-8222-222222222201','${b}','B private');
    insert into public.api_tokens(owner_id,name,token_hash,token_prefix) values
      ('${a}','A','${tokenA}','vji_a'),('${b}','B','${tokenB}','vji_b');
    set role authenticated;
    set request.jwt.claim.sub='${a}';
    set request.jwt.claim.role='authenticated';
  `);
  const rows = async (sql) => (await pg.query(sql)).rows[0].result;
  const own = await rows("select public.list_own_agent_decks() as result");
  assert.deepEqual(
    own.map((d) => d.name),
    ["A empty", "A second"],
  );
  assert.ok(own.every((d) => d.owner_id === a));
  assert.equal(
    (await rows("select public.list_own_agent_decks(1,1) as result"))[0].name,
    "A second",
  );
  await assert.rejects(
    pg.query("select public.list_own_agent_decks(0,0)"),
    /invalid pagination/,
  );
  await assert.rejects(
    pg.query(`select public.agent_list_decks('${tokenB}')`),
    /permission denied/,
  );
  await assert.rejects(
    pg.query(`select private.list_agent_decks_for_owner('${b}',51,0)`),
    /permission denied/,
  );
  await pg.exec(
    "reset role; set role service_role; set request.jwt.claim.role='service_role';",
  );
  const tokenRows = await rows(
    `select public.agent_list_decks('${tokenB}') as result`,
  );
  assert.deepEqual(
    tokenRows.map((d) => d.name),
    ["B private"],
  );
  assert.ok(tokenRows.every((d) => d.owner_id === b));
  await pg.exec("reset role;");
  assert.equal(
    (
      await pg.query(
        `select last_used_at is not null as used from public.api_tokens where token_hash='${tokenB}'`,
      )
    ).rows[0].used,
    true,
  );
  await pg.exec(
    `update public.api_tokens set revoked_at=now() where token_hash='${tokenB}'; set role service_role;`,
  );
  await assert.rejects(
    pg.query(`select public.agent_list_decks('${tokenB}')`),
    /not authenticated/,
  );
  await pg.exec(
    "reset role; set role anon; set request.jwt.claim.sub=''; set request.jwt.claim.role='anon';",
  );
  await assert.rejects(
    pg.query("select public.list_own_agent_decks()"),
    /permission denied/,
  );
  await assert.rejects(
    pg.query(`select public.agent_list_decks('${tokenA}')`),
    /permission denied/,
  );
  console.log(
    "PASS: real migrations, empty decks, pagination, two-account isolation, role grants, call record, token revocation",
  );
} finally {
  await pg.close();
}
