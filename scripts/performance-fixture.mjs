import { createServerClient } from '@supabase/ssr';
import nextEnv from '@next/env';
import { randomUUID } from 'node:crypto';

/** Only this disposable deck is mutated. Existing cards and settings are untouched. */
export async function createPerformanceFixture(count = 800) {
  nextEnv.loadEnvConfig(process.cwd());
  const cookies = new Map();
  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    cookies: { getAll: () => [...cookies.values()], setAll: entries => entries.forEach(x => cookies.set(x.name, x)) },
  });
  function checked(result) { if (result.error) throw new Error(result.error.message); return result.data; }
  const auth = checked(await db.auth.signInWithPassword({ email: process.env.PERF_EMAIL ?? 'demo@huaji.local', password: process.env.PERF_PASSWORD ?? 'huaji123456' }));
  const uid = auth.user.id;
  const deckId = randomUUID();
  const notes = Array.from({ length: count }, (_, i) => ({ id: randomUUID(), deck_id: deckId, owner_id: uid, type: 'qa', fields: { question: `性能卡 ${String(i).padStart(4, '0')}：清晰、快速地学习知识`, answer: `答案 ${i}` }, created_at: new Date(Date.now() - count * 1000 + i * 1000).toISOString() }));
  async function cleanup() {
    checked(await db.from('decks').delete().eq('id', deckId).eq('owner_id', uid));
    return checked(await db.from('decks').select('id').eq('id', deckId)).length === 0;
  }
  try {
    checked(await db.from('decks').insert({ id: deckId, owner_id: uid, name: '性能基准卡片盒', icon: 'book' }));
    checked(await db.from('notes').insert(notes));
    checked(await db.from('cards').insert(notes.map((n, i) => ({ note_id: n.id, deck_id: deckId, owner_id: uid, ord: 0, starred: i % 5 === 0 }))));
  } catch (error) { await cleanup(); throw error; }
  return { db, uid, deckId, notes, cleanup, cookies: (baseURL) => [...cookies.values()].filter(x => x.value).map(x => ({ name: x.name, value: x.value, url: baseURL, sameSite: 'Lax' })) };
}
