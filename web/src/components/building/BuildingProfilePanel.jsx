import { useState } from "react";
import { BUILDING_AMENITIES, formatBuildingScore } from "@shared/buildingProfile.js";
import BuildingScores, { OverallScore } from "./BuildingScores.jsx";

export default function BuildingProfilePanel({ apartment, onReanalyze, busy, source }) {
  const profile = apartment?.buildingProfile;
  const [openEvidence, setOpenEvidence] = useState(false);
  if (!profile) {
    return (
      <section className="building-profile-panel">
        <div className="section-head">
          <h2>Building profile</h2>
        </div>
        {source === "api" ? (
          <button type="button" className="btn btn-ghost" disabled={busy} onClick={onReanalyze}>
            {busy ? "Analyzing…" : "Re-analyze Building"}
          </button>
        ) : null}
      </section>
    );
  }

  const missing = profile.overallIncomplete && (profile.missingCategories || []).length > 0;
  const facts = profile.facts || {};

  return (
    <section className="building-profile-panel">
      <div className="section-head">
        <h2>Building profile</h2>
        <p>
          Overall <OverallScore profile={profile} />
          {missing ? " · incomplete" : ""}
        </p>
      </div>

      {profile.status === "skipped" || profile.status === "failed" ? (
        <p className={profile.status === "failed" ? "error" : "lede"}>{profile.summary}</p>
      ) : profile.status === "insufficient" && profile.overallScore == null ? (
        <p className="lede">The model could not score this building. Try Re-analyze or edit the prompt in server/src/buildingProfilePrompt.js.</p>
      ) : null}

      <BuildingScores profile={profile} />

      <dl className="building-facts">
        <div>
          <dt>Year built</dt>
          <dd>{profile.yearBuilt || "UNKNOWN"}</dd>
        </div>
        <div>
          <dt>Building age</dt>
          <dd>{profile.buildingAge != null ? `${profile.buildingAge} years` : "UNKNOWN"}</dd>
        </div>
        <div>
          <dt>Walk Score (fact)</dt>
          <dd>{facts.walkScore != null ? facts.walkScore : "UNKNOWN"}</dd>
        </div>
        <div>
          <dt>Management</dt>
          <dd>{facts.managementCompany || "UNKNOWN"}</dd>
        </div>
        {profile.judgments?.management?.score != null ? (
          <div>
            <dt>Management score</dt>
            <dd>
              {formatBuildingScore(profile.judgments.management.score)}/10 — {profile.judgments.management.rationale}
            </dd>
          </div>
        ) : null}
      </dl>

      {facts.reviewSummary ? (
        <div className="building-summary">
          <h3>Review themes</h3>
          <p>{facts.reviewSummary}</p>
        </div>
      ) : null}

      <div className="amenity-list">
        <h3>Amenities</h3>
        <ul>
          {BUILDING_AMENITIES.map((item) => {
            const present = (profile.amenities || []).includes(item.id);
            return (
              <li key={item.id} className={present ? "yes" : "no"}>
                {present ? "✓" : "–"} {item.label}
              </li>
            );
          })}
        </ul>
      </div>

      {profile.summary ? (
        <div className="building-summary">
          <h3>Summary</h3>
          <p>{profile.summary}</p>
        </div>
      ) : null}

      <details className="building-evidence" open={openEvidence} onToggle={(event) => setOpenEvidence(event.target.open)}>
        <summary>Sources / evidence</summary>
        {(profile.evidence || []).length === 0 ? (
          <p>No source quotes stored.</p>
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
        {profile.judgments?.buildingAge?.rationale ? (
          <p>
            Age score {formatBuildingScore(profile.buildingAgeScore)} is{" "}
            {profile.judgments.buildingAge.rationale}
          </p>
        ) : null}
        <p className="listing-date">
          Version {profile.analysisVersion || 0}
          {profile.analyzedAt ? ` · ${new Date(profile.analyzedAt).toLocaleString()}` : ""}
          {profile.model ? ` · ${profile.model}` : ""}
        </p>
      </details>

      {source === "api" ? (
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onReanalyze}>
          {busy ? "Re-analyzing…" : "Re-analyze Building"}
        </button>
      ) : null}
    </section>
  );
}
