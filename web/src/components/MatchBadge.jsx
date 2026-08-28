import { matchSummaryLines } from "@shared/match.js";
import { useState } from "react";

export default function MatchBadge({ match }) {
  if (!match?.configured) return null;
  if (!match.qualifies) {
    return <span className="match-badge match-fail">❌ DOES NOT QUALIFY</span>;
  }
  const tone = match.score >= 80 ? "good" : match.score >= 50 ? "mid" : "low";
  const emoji = tone === "good" ? "🟢" : tone === "mid" ? "🟡" : "🟠";
  return (
    <span className={`match-badge match-${tone}`}>
      {emoji} {match.score}% MATCH{match.profileName ? ` · ${match.profileName}` : ""}
    </span>
  );
}

export function MatchDetails({ match }) {
  const [open, setOpen] = useState(false);
  if (!match?.configured) return null;
  const lines = matchSummaryLines(match);

  return (
    <div className="match-details">
      {lines.length ? (
        <ul className="match-lines">
          {lines.map((line) => (
            <li key={line.id} className={`match-line match-line-${line.status}`}>
              {line.icon} {line.text}
            </li>
          ))}
        </ul>
      ) : null}
      <button type="button" className="text-link" onClick={() => setOpen((value) => !value)}>
        {open ? "Hide scoring" : "Why this matches"}
      </button>
      {open ? (
        <ol className="match-breakdown">
          {match.checks.map((check) => (
            <li key={check.id}>
              <strong>
                {check.label} {check.hard ? "(hard)" : "(preferred)"}
              </strong>
              <span>
                {check.points}/{check.maxPoints} pts — {check.detail}
              </span>
            </li>
          ))}
          <li className="match-total">
            {match.qualifies
              ? `Total ${match.earnedPoints}/${match.maxPoints} → ${match.score}%${match.profileName ? ` (${match.profileName})` : ""}`
              : "Hard requirement failed, so the score is 0."}
          </li>
          {match.profiles?.length > 1
            ? match.profiles.map((profile) => (
                <li key={profile.id || profile.name}>
                  {profile.qualifies ? `${profile.score}%` : "Does not qualify"} — {profile.name}
                </li>
              ))
            : null}
        </ol>
      ) : null}
    </div>
  );
}
