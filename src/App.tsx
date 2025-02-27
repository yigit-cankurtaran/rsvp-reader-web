import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import ReaderPage from "./pages/ReaderPage";
import TextPage from "./pages/TextPage";
import { cleanupLocalStorage } from "./helpers/libraryManager";
import { saveAppSettings } from "./helpers/dexieDB";
import "./styles/Pages.css";

function App() {
  // Run cleanup when the app starts
  useEffect(() => {
    // Add a small delay to not block app startup
    const timeoutId = setTimeout(() => {
      cleanupLocalStorage().catch((err) => {
        console.error("Error running storage cleanup:", err);
      });
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, []);

  // Set default view to library for first-time users
  useEffect(() => {
    const hasVisitedBefore = localStorage.getItem("speedReaderFirstVisit");
    if (!hasVisitedBefore) {
      localStorage.setItem("speedReaderFirstVisit", "true");
      localStorage.setItem("speedReaderInputType", "EPUB"); // Ensure EPUB is the default
    }
  }, []);

  // Initialize theme based on system preference when app first loads
  useEffect(() => {
    const savedTheme = localStorage.getItem("speedReaderTheme");

    // If no theme is saved, use system preference
    if (savedTheme === null) {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      const theme = prefersDark ? "dark" : "light";

      // Save to localStorage
      localStorage.setItem("speedReaderTheme", theme);

      // Also save to IndexedDB
      saveAppSettings({ theme }).catch((err) => {
        console.error("Error saving initial theme to IndexedDB:", err);
      });

      // Apply the theme to document
      document.documentElement.setAttribute("data-theme", theme);
    } else {
      // Apply saved theme
      document.documentElement.setAttribute("data-theme", savedTheme);
    }

    // Set up listener for system theme changes
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleThemeChange = (e: MediaQueryListEvent) => {
      // Only update if user hasn't explicitly set a preference
      if (localStorage.getItem("speedReaderTheme") === null) {
        const newTheme = e.matches ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("speedReaderTheme", newTheme);
      }
    };

    // Add event listener for theme changes
    mediaQuery.addEventListener("change", handleThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleThemeChange);
    };
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        {/* Place the root route first to ensure proper matching */}
        <Route path="/" element={<Navigate to="/library" replace />} />

        {/* Other routes */}
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/reader" element={<ReaderPage />} />
        <Route path="/text" element={<TextPage />} />

        {/* Fallback route - redirect to library */}
        <Route path="*" element={<Navigate to="/library" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
