import { Link, NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell.jsx";

export default function Shell({ children, action, source }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
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
          <nav className="top-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/changes">Recent changes</NavLink>
          </nav>
        </div>
        <div className="topbar-right">
          <NotificationBell source={source} />
          {action}
        </div>
      </header>
      {children}
    </div>
  );
}
