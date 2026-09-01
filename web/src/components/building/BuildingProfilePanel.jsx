import { useState } from "react";
import { BUILDING_AMENITIES, formatBuildingScore, formatYearBuiltAge } from "@shared/buildingProfile.js";
import BuildingScores from "./BuildingScores.jsx";
import BuildingBulletList from "./BuildingBulletList.jsx";

function profileSummaryHint(profile) {
  if (!profile) return "Not scored";
  if (profile.overallScore != null) return `${formatBuildingScore(profile.overallScore)} overall`;
  if (profile.status === "running" || profile.status === "pending") return "Scoring…";
  return formatYearBuiltAge(profile);
}

export default function BuildingProfilePanel({ apartment, onReanalyze, busy, source }) {
  const profile = apartment?.buildingProfile;
  const [openEvidence, setOpenEvidence] = useState(false);

  if (!profile) {
    return (
      <details className="metadata-panel building-profile-panel">
        <summary className="metadata-panel-summary">
          <span>Building</span>
          <span className="metadata-panel-hint">Not scored</span>
        </summary>
        <div className="metadata-panel-body">
          <p className="building-profile-sub">Research scores once per building.</p>
          {source === "api" ? (
            <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={onReanalyze}>
              {busy ? "Scoring…" : "Score building"}
            </button>
          ) : null}
        </div>
      </details>
    );
  }

  const partial = profile.overallIncomplete && (profile.missingCategories || []).length > 0;
  const facts = profile.facts || {};
  const presentAmenities = BUILDING_AMENITIES.filter((item) => (profile.amenities || []).includes(item.id));

  return (
    <details className="metadata-panel building-profile-panel">
      <summary className="metadata-panel-summary">
        <span>Building</span>
        <span className="metadata-panel-hint">
          {profileSummaryHint(profile)}
          {partial ? " · partial" : ""}
        </span>
      </summary>
      <div className="metadata-panel-body">
        <p className="building-profile-sub">
          {formatYearBuiltAge(profile)}
          {facts.managementCompany ? ` · ${facts.managementCompany}` : ""}
        </p>

        {profile.overallScore != null ? (
          <div className="building-profile-overall">
            <span className="building-profile-overall-label">Overall</span>
            <span className="score-number">{formatBuildingScore(profile.overallScore)}</span>
          </div>
        ) : null}

        {profile.status === "skipped" || profile.status === "failed" ? (
          <p className={profile.status === "failed" ? "form-error" : "building-scores-empty"}>{profile.summary}</p>
        ) : profile.status === "insufficient" && profile.overallScore == null ? (
          <p className="building-scores-empty">Not enough data. Score again to retry.</p>
        ) : null}

        <BuildingScores profile={profile} />

        {facts.reviewSummary ? (
          <div className="building-summary">
            <h3>Reviews</h3>
            <BuildingBulletList text={facts.reviewSummary} />
          </div>
        ) : null}

        {presentAmenities.length ? (
          <div className="amenity-list">
            <h3>Amenities</h3>
            <div className="amenity-chips">
              {presentAmenities.map((item) => (
                <span key={item.id} className="amenity-chip">
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {profile.summary ? (
          <div className="building-summary">
            <h3>Notes</h3>
            <BuildingBulletList text={profile.summary} />
          </div>
        ) : null}

        <details className="building-evidence" open={openEvidence} onToggle={(event) => setOpenEvidence(event.target.open)}>
          <summary>Sources</summary>
          {(profile.evidence || []).length === 0 ? (
            <p className="building-scores-empty">None</p>
          ) : (
            <ul>
              {profile.evidence.map((item, index) => (
                <li key={`${item.category}-${index}`}>
                  <strong>{item.category}</strong>
                  {item.fact ? ` — ${item.fact}` : ""}
                  {item.quote ? <blockquote>{item.quote}</blockquote> : null}
                </li>
              ))}
            </ul>
          )}
          {profile.judgments?.management?.rationale ? (
            <p className="building-evidence-note">
              <strong>Management</strong> {formatBuildingScore(profile.judgments.management.score)} —{" "}
              {profile.judgments.management.rationale}
            </p>
          ) : null}
          {profile.judgments?.amenities?.rationale ? (
            <p className="building-evidence-note">
              <strong>Amenities</strong> {formatBuildingScore(profile.amenitiesScore)} —{" "}
              {profile.judgments.amenities.rationale}
            </p>
          ) : null}
          <p className="listing-date">
            v{profile.analysisVersion || 0}
            {profile.analyzedAt ? ` · ${new Date(profile.analyzedAt).toLocaleString()}` : ""}
          </p>
        </details>

        {source === "api" ? (
          <button type="button" className="btn btn-ghost btn-small" disabled={busy} onClick={onReanalyze}>
            {busy ? "Scoring…" : "Score again"}
          </button>
        ) : null}
      </div>
    </details>
  );
}
