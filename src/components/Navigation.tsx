import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import ThemeToggle from "./ThemeToggle";
import "../styles/Navigation.css";

const Navigation: React.FC = () => {
  const location = useLocation();

  // Check if we're on a reader page with a book ID
  const isReaderActive = location.pathname.startsWith("/reader");
  // Check if path is exactly root or library
  const isLibraryActive =
    location.pathname === "/" || location.pathname === "/library";
  // Check if we're on text input page

  return (
    <nav className="app-navigation">
      <ul className="nav-links">
        <li>
          <NavLink to="/library" className={isLibraryActive ? "active" : ""}>
            Library
          </NavLink>
        </li>
        <li>
          <NavLink to="/reader" className={isReaderActive ? "active" : ""}>
            Reader
          </NavLink>
        </li>
      </ul>
      <div className="nav-controls">
        <ThemeToggle />
      </div>
    </nav>
  );
};

export default Navigation;
