import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import ReaderPage from "./pages/ReaderPage";
import TextPage from "./pages/TextPage";
import { cleanupLocalStorage } from "./helpers/libraryManager";
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/library" element={<LibraryPage />} />
        <Route path="/reader/:bookId" element={<ReaderPage />} />
        <Route path="/reader" element={<ReaderPage />} />
        <Route path="/text" element={<TextPage />} />
        <Route path="/" element={<Navigate to="/library" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
