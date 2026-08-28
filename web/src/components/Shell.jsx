import { Link, NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell.jsx";

export default function Shell({ children, action, source }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <Link to="/" className="brand">
            <img src={`${import.meta.env.BASE_URL}icon.png`} alt="" width="40" height="40" />
            <span className="brand-name">AptWatch</span>
          </Link>
          <nav className="top-nav">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/changes">Recent changes</NavLink>
            <NavLink to="/preferences">Preferences</NavLink>
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
