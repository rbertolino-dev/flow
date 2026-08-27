import type { SupabaseClient } from "@supabase/supabase-js";

type QueueTable = "broadcast_queue_2" | "broadcast_queue_waha";

export async function deletePendingQueueItems(
  supabase: SupabaseClient,
  table: QueueTable,
  campaignId: string,
): Promise<void> {
  const { error } = await supabase
    .from(table)
    .delete()
    .eq("campaign_id", campaignId)
    .eq("status", "pending");
  if (error) throw error;
}

export async function insertQueueInChunks<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: QueueTable,
  rows: T[],
  chunkSize = 200,
): Promise<void> {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const { error } = await supabase.from(table).insert(rows.slice(index, index + chunkSize));
    if (error) throw error;
  }
}

export async function rebuildDraftQueue<T extends Record<string, unknown>>(
  supabase: SupabaseClient,
  table: QueueTable,
  campaignId: string,
  rows: T[],
): Promise<void> {
  await deletePendingQueueItems(supabase, table, campaignId);
  if (rows.length > 0) {
    await insertQueueInChunks(supabase, table, rows);
  }
}
