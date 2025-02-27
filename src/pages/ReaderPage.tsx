import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import SpeedReader from "../SpeedReader";
import Navigation from "../components/Navigation";
import { getBookById } from "../helpers/libraryManager";

const ReaderPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId?: string }>();
  const [currentBookId, setCurrentBookId] = useState<string | null>(
    bookId || null
  );

  // Navigation handlers
  const handleGoToLibrary = () => {
    navigate("/library");
  };

  const handleGoToReader = (newBookId?: string) => {
    if (newBookId) {
      navigate(`/reader/${newBookId}`);
      setCurrentBookId(newBookId);
    } else {
      navigate("/reader");
    }
  };

  // Check if the book exists
  useEffect(() => {
    const verifyBook = async () => {
      if (bookId) {
        try {
          const book = await getBookById(bookId);
          if (!book) {
            console.warn(
              `Book with ID ${bookId} not found, redirecting to library`
            );
            navigate("/library");
          }
        } catch (error) {
          console.error("Error verifying book:", error);
          navigate("/library");
        }
      }
    };

    verifyBook();
  }, [bookId, navigate]);

  // If we're using a text-input loaded from localStorage
  useEffect(() => {
    const words = localStorage.getItem("speedReaderWords");
    if (!bookId && words) {
      // We have text content but no book ID (direct text input)
      console.log("Loading reader with text input content (no book ID)");
    }
  }, [bookId]);

  return (
    <div className="page-container">
      <Navigation />
      <div className="reader-page">
        <SpeedReader
          viewMode="reader"
          onNavigateToLibrary={handleGoToLibrary}
          onNavigateToReader={handleGoToReader}
          initialBookId={currentBookId}
        />
      </div>
    </div>
  );
};

export default ReaderPage;
