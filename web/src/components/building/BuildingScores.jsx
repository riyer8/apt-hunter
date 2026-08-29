import { Link } from "react-router-dom";
import {
  BUILDING_SCORE_KEYS,
  formatBuildingScore,
  scoreBand,
  scoreEmoji,
} from "@shared/buildingProfile.js";

const SCORE_FIELDS = {
  safety: "safetyScore",
  buildingAge: "buildingAgeScore",
  walkability: "walkabilityScore",
  viewsSun: "viewsSunScore",
  amenities: "amenitiesScore",
};

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

  return (
    <div className={compact ? "building-scores compact" : "building-scores"}>
      {compact ? <p className="building-scores-label">Building</p> : null}
      <dl>
        {BUILDING_SCORE_KEYS.map((item) => {
          const score = profile[SCORE_FIELDS[item.id]];
          return (
            <div key={item.id} className={`score-row band-${scoreBand(score)}`}>
              <dt>{compact ? item.short : item.label}</dt>
              <dd>
                <span className="score-number">{formatBuildingScore(score)}</span>
                {score != null ? <span className="score-over">/10</span> : null}{" "}
                <span aria-hidden="true">{scoreEmoji(score)}</span>
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
      <span className="score-over">/10</span> {scoreEmoji(profile.overallScore)}
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
