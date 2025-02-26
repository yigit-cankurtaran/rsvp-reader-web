import React, { useState, useEffect } from "react";
import { Book } from "../types/reader";
import {
  getLibrary,
  removeBook,
  generateFallbackCover,
} from "../helpers/libraryManager";
import "../styles/Library.css";

interface LibraryProps {
  onSelectBook: (bookId: string) => void;
}

const Library: React.FC<LibraryProps> = ({ onSelectBook }) => {
  const [books, setBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load books from localStorage
    const loadedBooks = getLibrary();
    setBooks(loadedBooks);
    setIsLoading(false);
  }, []);

  const handleBookClick = (bookId: string) => {
    onSelectBook(bookId);
  };

  const handleRemoveBook = (e: React.MouseEvent, bookId: string) => {
    e.stopPropagation(); // Prevent triggering the book click
    if (
      window.confirm(
        "Are you sure you want to remove this book from your library?"
      )
    ) {
      removeBook(bookId);
      setBooks(books.filter((book) => book.id !== bookId));
    }
  };

  const getProgressPercentage = (book: Book) => {
    if (book.totalWords === 0) return 0;
    return Math.min(
      100,
      Math.round((book.currentWordIndex / book.totalWords) * 100)
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch (e) {
      return "Unknown date";
    }
  };

  if (isLoading) {
    return <div className="library-loading">Loading your library...</div>;
  }

  if (books.length === 0) {
    return (
      <div className="library-empty">
        <h2>Your library is empty</h2>
        <p>Upload an EPUB file to start reading</p>
      </div>
    );
  }

  return (
    <div className="library-container">
      <h2 className="library-title">Your Library</h2>
      <div className="library-grid">
        {books.map((book) => {
          const progressPercent = getProgressPercentage(book);
          const coverUrl =
            book.coverUrl || generateFallbackCover(book.title, book.author);

          return (
            <div
              key={book.id}
              className="book-card"
              onClick={() => handleBookClick(book.id)}
            >
              <div className="book-cover-container">
                <img
                  src={coverUrl}
                  alt={`Cover of ${book.title}`}
                  className="book-cover"
                  onError={(e) => {
                    // If image fails to load, replace with fallback
                    const target = e.target as HTMLImageElement;
                    target.src = generateFallbackCover(book.title, book.author);
                  }}
                />
                <div className="book-progress-bar">
                  <div
                    className="book-progress-fill"
                    style={{ width: `${progressPercent}%` }}
                  ></div>
                </div>
                <div className="book-progress-text">{progressPercent}%</div>
              </div>
              <div className="book-info">
                <h3 className="book-title">{book.title}</h3>
                <p className="book-author">{book.author}</p>
                <p className="book-last-read">
                  Last read: {formatDate(book.lastReadDate)}
                </p>
              </div>
              <button
                className="book-remove-btn"
                onClick={(e) => handleRemoveBook(e, book.id)}
                aria-label="Remove book"
              >
                ×
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Library;
