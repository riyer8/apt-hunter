import { Link } from "react-router-dom";
import {
  BUILDING_SCORE_KEYS,
  formatBuildingScore,
  scoreBand,
} from "@shared/buildingProfile.js";

const SCORE_FIELDS = {
  safety: "safetyScore",
  buildingAge: "buildingAgeScore",
  walkability: "walkabilityScore",
  viewsSun: "viewsSunScore",
  amenities: "amenitiesScore",
};

function scoreValue(profile, itemId) {
  if (itemId === "management") {
    return profile?.judgments?.management?.score ?? null;
  }
  return profile[SCORE_FIELDS[itemId]];
}

function scoreItems(profile) {
  const items = [...BUILDING_SCORE_KEYS];
  if (profile?.judgments?.management?.score != null) {
    items.push({ id: "management", label: "Management", short: "Mgmt", weight: 0 });
  }
  return items;
}

export default function BuildingScores({ profile, compact = false }) {
  if (!profile) {
    return compact ? <p className="building-scores-empty">Building scores unavailable</p> : null;
  }

  if (profile.status === "pending" || profile.status === "running") {
    return <p className="building-scores-empty">Researching this building…</p>;
  }
  if (compact && (profile.status === "skipped" || profile.status === "failed")) {
    return <p className="building-scores-empty">Building scores UNKNOWN</p>;
  }

  const items = scoreItems(profile);

  return (
    <div className={compact ? "building-scores compact" : "building-scores"}>
      {compact ? <p className="building-scores-label">Building</p> : null}
      <dl>
        {items.map((item) => {
          const score = scoreValue(profile, item.id);
          return (
            <div key={item.id} className={`score-card band-${scoreBand(score)}`}>
              <dt>{compact ? item.short : item.label}</dt>
              <dd>
                <span className="score-number">{formatBuildingScore(score)}</span>
                <span className="sr-only">{scoreBand(score)}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

export function OverallScore({ profile }) {
  if (!profile || profile.overallScore == null) {
    return <span className="score-number">UNKNOWN</span>;
  }
  return (
    <span className={`overall-score band-${scoreBand(profile.overallScore)}`}>
      <span className="score-number">{formatBuildingScore(profile.overallScore)}</span>
      <span className="score-over">/10</span>
    </span>
  );
}

export function BuildingNameLink({ listing, className }) {
  if (!listing?.apartmentName) return null;
  if (!listing.apartmentId) return <span className={className}>{listing.apartmentName}</span>;
  return (
    <Link className={className} to={`/apartments/${listing.apartmentId}`}>
      {listing.apartmentName}
    </Link>
  );
}
