import { BellRing } from "lucide-react";
import { EmptyState } from "@/components/ui/States";

/**
 * PLACEHOLDER — built next.
 *
 * Partially blocked: acknowledging works (`POST /alerts/{id}/acknowledge`
 * with decision "Agree" | "Disagree"), but the alert payload carries no
 * person reference — only `score_id`, and no endpoint resolves a score to a
 * person. An officer would be agreeing or disagreeing without seeing whose
 * case it is. See docs/api-contract.md § Gap 2.
 */
export default function AlertReviewPage() {
  return (
    <div className="card">
      <EmptyState
        icon={BellRing}
        title="Alert review — next up"
        description="Acknowledgement is ready to wire; alerts still need a person reference so an officer can see the case behind each one."
      />
    </div>
  );
}
