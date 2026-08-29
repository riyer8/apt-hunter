import { useMemo } from "react";
import CollapsibleSection from "./CollapsibleSection.jsx";
import { summarizeListings } from "../lib/dashboardSummaries.js";
import ListingCard from "./ListingCard.jsx";

export default function CuratedUnitsSection({
  title,
  listings,
  showBuilding = false,
  onSelectionChange,
  selectionBusyId = "",
  defaultOpen = false,
  action,
  compact = false,
}) {
  const summary = useMemo(() => summarizeListings(listings), [listings]);

  return (
    <CollapsibleSection
      title={title}
      headline={summary.headline}
      preview={summary.preview}
      defaultOpen={defaultOpen}
      action={action}
      bodyClassName="changed-rail"
    >
      {listings.map((listing) => (
        <ListingCard
          key={listing.id}
          listing={listing}
          showBuilding={showBuilding}
          compact={compact}
          onSelectionChange={onSelectionChange ? (patch) => onSelectionChange(listing.id, patch) : undefined}
          selectionBusy={selectionBusyId === listing.id}
        />
      ))}
    </CollapsibleSection>
  );
}
