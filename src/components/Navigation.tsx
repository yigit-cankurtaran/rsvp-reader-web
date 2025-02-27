import React from "react";
import { NavLink, useLocation } from "react-router-dom";
import "../styles/Navigation.css";

const Navigation: React.FC = () => {
  const location = useLocation();

  // Check if we're on a reader page with a book ID
  const isReaderActive = location.pathname.startsWith("/reader");

  return (
    <nav className="app-navigation">
      <ul>
        <li>
          <NavLink
            to="/library"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Library
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/reader"
            className={({ isActive }) =>
              isActive || isReaderActive ? "active" : ""
            }
          >
            Reader
          </NavLink>
        </li>
        <li>
          <NavLink
            to="/text"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Text Input
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default Navigation;
