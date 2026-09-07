import { useParams } from "react-router-dom";
import { LineChart } from "lucide-react";
import { EmptyState } from "@/components/ui/States";

/**
 * PLACEHOLDER — built next.
 *
 * This one is NOT blocked: `GET /people/{id}/history?accessed_by=...` already
 * returns person, checkins, scores (with per-component breakdown and bands),
 * case_events and alerts — everything the trend chart and history need.
 */
export default function CaseDetailPage() {
  const { personId } = useParams();

  return (
    <div className="card">
      <EmptyState
        icon={LineChart}
        title="Case detail — next up"
        description={`Trend chart, case history and risk band for ${personId}. The history endpoint already returns everything this needs.`}
      />
    </div>
  );
}
