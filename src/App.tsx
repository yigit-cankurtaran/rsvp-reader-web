import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import LibraryPage from "./pages/LibraryPage";
import ReaderPage from "./pages/ReaderPage";
import TextPage from "./pages/TextPage";
import "./styles/Pages.css";

function App() {
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
