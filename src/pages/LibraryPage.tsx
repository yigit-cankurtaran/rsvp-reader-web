import React from "react";
import { useNavigate } from "react-router-dom";
import SpeedReader from "../SpeedReader";
import Navigation from "../components/Navigation";
import Footer from "../components/Footer";

const LibraryPage: React.FC = () => {
  const navigate = useNavigate();

  // Navigation handlers
  const handleGoToLibrary = () => {
    navigate("/library");
  };

  const handleGoToReader = (bookId?: string) => {
    if (bookId) {
      navigate(`/reader/${bookId}`);
    } else {
      navigate("/reader");
    }
  };

  return (
    <div className="page-container">
      <Navigation />
      <div className="library-page">
        <SpeedReader
          viewMode="library"
          onNavigateToLibrary={handleGoToLibrary}
          onNavigateToReader={handleGoToReader}
        />
      </div>
      <Footer />
    </div>
  );
};

export default LibraryPage;
