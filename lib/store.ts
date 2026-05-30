import { config } from "@/lib/config";
import { getKv, type KvBackend } from "@/lib/kv";
import type { RunRecord } from "@/lib/types";

// Stage of U8: the run store (KTD4). Every completed run is written here so the
// dashboard can list it and a saved run can be reopened by URL. The shape is
// deliberately simple — no SQL, no schema:
//
//   - a single Redis list (config.store.listKey) holds run ids, newest-first;
//   - each full RunRecord is stored at its own key (recordPrefix + id) with a
//     TTL so public personal data is not kept forever (KTD10).
//
// Writes use atomic list ops (LPUSH the id, then SET the record) — never a
// read-modify-write of one big JSON array, which is the race KTD4 avoids. Each
// function takes an optional backend so tests can pass an isolated in-memory one
// (same pattern as the injectable pipeline stages).

const { listKey, recordPrefix, listCap, ttlDays } = config.store;
const recordKey = (id: string) => `${recordPrefix}${id}`;
const ttlSeconds = ttlDays * 24 * 60 * 60;

// Save a finished run: store the record by id (with TTL), push its id onto the
// head of the list, then trim the list to the cap so it can't grow unbounded.
export async function saveRun(
  record: RunRecord,
  kv: KvBackend = getKv(),
): Promise<void> {
  await kv.set(recordKey(record.id), record, { ttlSeconds });
  await kv.lpush(listKey, record.id);
  await kv.ltrim(listKey, 0, listCap - 1);
}

// List recent runs, newest-first. Reads the id list, then fetches all records
// in one batch. A record whose id is still listed but whose record has expired
// (TTL) comes back null and is filtered out, so the list self-heals.
export async function listRuns(kv: KvBackend = getKv()): Promise<RunRecord[]> {
  const ids = await kv.lrange(listKey, 0, listCap - 1);
  if (ids.length === 0) return [];
  const records = await kv.mget<RunRecord>(ids.map(recordKey));
  return records.filter((r): r is RunRecord => r != null);
}

// Fetch one run by id (for the reopen-a-saved-run page). null if unknown/expired.
export async function getRun(
  id: string,
  kv: KvBackend = getKv(),
): Promise<RunRecord | null> {
  return kv.get<RunRecord>(recordKey(id));
}
