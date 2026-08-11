import { useSearchParams } from "react-router-dom";

import BroadcastCampaigns2 from "@/pages/BroadcastCampaigns2";
import BroadcastCampaignsWaha from "@/pages/BroadcastCampaignsWaha";

export default function BroadcastCampaignsHub() {
  const [searchParams] = useSearchParams();
  const provider = searchParams.get("provider");

  if (provider === "waha") return <BroadcastCampaignsWaha />;
  return <BroadcastCampaigns2 />;
}
