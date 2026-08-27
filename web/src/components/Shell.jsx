import { Link } from "react-router-dom";

export default function Shell({ children, action, source }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" width="40" height="40" />
          <span>
            <span className="brand-name">AptWatch</span>
            <span className="brand-kicker">
              {source === "api"
                ? "Synced with the backend"
                : source === "extension"
                  ? "Synced with the extension"
                  : "Watch for the right unit"}
            </span>
          </span>
        </Link>
        {action}
      </header>
      {children}
    </div>
  );
}
