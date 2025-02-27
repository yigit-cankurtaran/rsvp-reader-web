import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navigation from "../components/Navigation";
import { getBookById } from "../helpers/libraryManager";
import BookReader from "../components/BookReader";

const ReaderPage: React.FC = () => {
  const navigate = useNavigate();
  const { bookId } = useParams<{ bookId?: string }>();

  // Initialize with either the URL parameter or the last read book from localStorage
  const [currentBookId, setCurrentBookId] = useState<string | null>(() => {
    if (bookId) return bookId;

    // If no bookId in URL, try to get the last read book from localStorage
    const lastBookId = localStorage.getItem("speedReaderCurrentBookId");
    return lastBookId || null;
  });

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

  // Check if the book exists and update URL if needed
  useEffect(() => {
    const verifyBook = async () => {
      // If bookId from URL is provided, use that
      if (bookId) {
        try {
          const book = await getBookById(bookId);
          if (!book) {
            console.warn(
              `Book with ID ${bookId} not found, redirecting to library`
            );
            navigate("/library");
          } else {
            // Book found, ensure localStorage is updated
            localStorage.setItem("speedReaderCurrentBookId", bookId);
            setCurrentBookId(bookId);
          }
        } catch (error) {
          console.error("Error verifying book:", error);
          navigate("/library");
        }
      }
      // If no bookId in URL but we have one in state (from localStorage)
      else if (currentBookId) {
        try {
          const book = await getBookById(currentBookId);
          if (book) {
            // We have a valid book, update the URL to match
            navigate(`/reader/${currentBookId}`, { replace: true });
          } else {
            // Book not found, clear the invalid reference
            localStorage.removeItem("speedReaderCurrentBookId");
            setCurrentBookId(null);
          }
        } catch (error) {
          console.error("Error verifying book from localStorage:", error);
          setCurrentBookId(null);
        }
      }
    };

    verifyBook();
  }, [bookId, navigate, currentBookId]);

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
