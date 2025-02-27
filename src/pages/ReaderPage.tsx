import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "../components/Navigation";
import { getBookById } from "../helpers/libraryManager";
import BookReader from "../components/BookReader";

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

  // If there's no book ID, show a prompt to select a book
  if (!currentBookId) {
    return (
      <div className="page-container">
        <Navigation />
        <div className="reader-page">
          <div className="reader-empty-state">
            <h2>No Book Selected</h2>
            <p>Please select a book from your library to start reading</p>
            <button onClick={handleGoToLibrary} className="go-to-library-btn">
              Go to Library
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <Navigation />
      <div className="reader-page">
        <BookReader
          bookId={currentBookId}
          onBackToLibrary={handleGoToLibrary}
        />
      </div>
    </div>
  );
};

export default ReaderPage;
