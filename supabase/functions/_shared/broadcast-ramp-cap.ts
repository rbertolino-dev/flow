/** Cap de processamento na janela de rampa (1ª onda rotate). */

export const BROADCAST_RAMP_WINDOW_MS = 15 * 60 * 1000;

type CampaignRampInfo = {
  id?: string;
  sending_method?: string | null;
  started_at?: string | null;
  instance_ids?: string[] | null;
};

type QueueItemWithCampaign = {
  id: string;
  instance_id?: string | null;
  scheduled_for?: string | null;
  campaign?: CampaignRampInfo | null;
};

function poolSizeForCampaign(campaign: CampaignRampInfo, items: QueueItemWithCampaign[]): number {
  if (Array.isArray(campaign.instance_ids) && campaign.instance_ids.length > 0) {
    return campaign.instance_ids.length;
  }
  return new Set(items.map((i) => i.instance_id).filter(Boolean)).size || 1;
}

function isCampaignInRampWindow(campaign: CampaignRampInfo, nowMs: number): boolean {
  if (campaign.sending_method !== "rotate") return false;
  const started = campaign.started_at;
  if (!started) return false;
  const ageMs = nowMs - new Date(started).getTime();
  return ageMs >= 0 && ageMs < BROADCAST_RAMP_WINDOW_MS;
}

/**
 * Durante a rampa (15 min pós-início rotate), limita itens processados por campanha
 * ao tamanho do pool — no máximo ~1 envio por chip por tick do cron.
 */
export function applyRampProcessingCap<T extends QueueItemWithCampaign>(
  items: T[],
  nowMs = Date.now(),
): T[] {
  const byCampaign = new Map<string, T[]>();
  const noCampaign: T[] = [];

  for (const item of items) {
    const cid = item.campaign?.id;
    if (!cid) {
      noCampaign.push(item);
      continue;
    }
    if (!byCampaign.has(cid)) byCampaign.set(cid, []);
    byCampaign.get(cid)!.push(item);
  }

  const out: T[] = [...noCampaign];

  for (const [, campItems] of byCampaign) {
    const campaign = campItems[0]?.campaign;
    if (!campaign || !isCampaignInRampWindow(campaign, nowMs)) {
      out.push(...campItems);
      continue;
    }

    const cap = Math.max(1, poolSizeForCampaign(campaign, campItems));
    const sorted = [...campItems].sort((a, b) => {
      const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
      const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
      return ta - tb;
    });
    out.push(...sorted.slice(0, cap));
  }

  return out.sort((a, b) => {
    const ta = a.scheduled_for ? new Date(a.scheduled_for).getTime() : 0;
    const tb = b.scheduled_for ? new Date(b.scheduled_for).getTime() : 0;
    return ta - tb;
  });
}
