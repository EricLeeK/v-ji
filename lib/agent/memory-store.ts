import { randomUUID } from "node:crypto";
import {
  applyListQuery,
  type AgentCard,
  type CardStore,
  type ListQuery,
  type SaveCardInput,
  CardStoreError,
} from "@/lib/agent/cards";

type Row = AgentCard & { ownerId: string };

export function createMemoryDirectory() {
  const decks = new Map<string, { ownerId: string; name: string }>();
  const notes: Row[] = [];

  function storeFor(ownerId: string): CardStore {
    return {
      async listDecks(limit, offset) {
        return [...decks]
          .filter(([, deck]) => deck.ownerId === ownerId)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(offset, offset + limit)
          .map(([id, deck]) => ({ id, name: deck.name }));
      },
      async list(query: ListQuery) {
        return applyListQuery(
          notes.filter((note) => note.ownerId === ownerId).map(strip),
          query,
        );
      },
      async get(id: string) {
        const note = notes.find(
          (item) => item.id === id && item.ownerId === ownerId,
        );
        return note ? strip(note) : null;
      },
      async save(input: SaveCardInput) {
        const deck = decks.get(input.deckId);
        if (!deck || deck.ownerId !== ownerId)
          throw new CardStoreError("deck_not_found", "卡片盒不存在");
        const now = new Date().toISOString();
        if (!input.id) {
          const created: Row = {
            id: randomUUID(),
            ownerId,
            deckId: input.deckId,
            deckName: deck.name,
            type: input.type,
            fields: input.fields,
            tags: input.tags,
            layout: input.layout,
            source: input.source,
            createdAt: now,
            updatedAt: now,
          };
          notes.push(created);
          return strip(created);
        }
        const index = notes.findIndex(
          (item) => item.id === input.id && item.ownerId === ownerId,
        );
        if (index < 0) throw new CardStoreError("not_found", "卡片不存在");
        const current = notes[index];
        const updated: Row = {
          ...current,
          deckId: input.deckId,
          deckName: deck.name,
          type: input.type,
          fields: input.fields,
          tags: input.tags,
          layout: input.layout,
          source: input.source,
          updatedAt: now,
        };
        notes[index] = updated;
        return strip(updated);
      },
    };
  }

  return {
    addDeck(ownerId: string, id: string, name = "卡片盒") {
      decks.set(id, { ownerId, name });
    },
    storeFor,
    cardsOf(ownerId: string) {
      return notes.filter((note) => note.ownerId === ownerId).map(strip);
    },
  };
}

function strip(note: Row): AgentCard {
  return {
    id: note.id,
    deckId: note.deckId,
    deckName: note.deckName,
    type: note.type,
    fields: note.fields,
    tags: note.tags,
    layout: note.layout,
    source: note.source,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
  };
}
