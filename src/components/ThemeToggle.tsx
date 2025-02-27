import React, { useState, useEffect } from "react";
import { saveAppSettings } from "../helpers/dexieDB";
import "../styles/ThemeToggle.css";

const ThemeToggle: React.FC = () => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Read from localStorage on component mount
    const savedTheme = localStorage.getItem("speedReaderTheme");
    if (savedTheme === null) {
      // If no saved preference, use system preference
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return savedTheme === "dark";
  });

  // Effect to apply theme changes
  useEffect(() => {
    const theme = isDarkMode ? "dark" : "light";

    // Apply to document
    document.documentElement.setAttribute("data-theme", theme);

    // Save to localStorage
    localStorage.setItem("speedReaderTheme", theme);

    // Save to IndexedDB for long-term persistence
    saveAppSettings({ theme }).catch((err) => {
      console.error("Error saving theme to IndexedDB:", err);
    });
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode((prev) => !prev);
  };

  return (
    <button
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDarkMode ? (
        <span role="img" aria-label="Light mode">
          ☀️
        </span>
      ) : (
        <span role="img" aria-label="Dark mode">
          🌙
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;
