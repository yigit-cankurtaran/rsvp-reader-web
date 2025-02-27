import React, { useState, useEffect, useCallback } from "react";
import "../styles/BookReader.css";
import { getBookById, updateBookProgress } from "../helpers/libraryManager";
import { getWordsForBook } from "../helpers/bookStorage";
import { Chapter } from "../types/reader";
import WordReader from "./WordReader";
import ReaderControls from "./ReaderControls";

interface BookReaderProps {
  bookId: string;
  onBackToLibrary?: () => void;
}

const BookReader: React.FC<BookReaderProps> = ({ bookId, onBackToLibrary }) => {
  // Reader state
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(() => {
    // Load WPM from localStorage or use default
    const savedWpm = localStorage.getItem("speedReaderWpm");
    return savedWpm ? parseInt(savedWpm, 10) : 300;
  });
  const [bookTitle, setBookTitle] = useState("");
  const [fileName, setFileName] = useState("");
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Load theme from localStorage or use system preference
    const savedTheme = localStorage.getItem("speedReaderTheme");
    return (
      savedTheme === "dark" ||
      (savedTheme === null &&
        document.documentElement.getAttribute("data-theme") === "dark")
    );
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize theme from localStorage on component mount
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
  }, []);

  // Load book data
  useEffect(() => {
    const loadBook = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Get book data from IndexedDB
        const book = await getBookById(bookId);
        if (!book) {
          setError(`Book with ID ${bookId} not found`);
          setIsLoading(false);
          return;
        }

        setBookTitle(book.title);
        setFileName(book.fileName);
        setCurrentWordIndex(book.currentWordIndex);

        if (book.chapters && book.chapters.length > 0) {
          setChapters(book.chapters);

          // Find the current chapter based on word index
          const chapterIndex = book.chapters.findIndex(
            (chapter) =>
              book.currentWordIndex >= chapter.startIndex &&
              book.currentWordIndex <= chapter.endIndex
          );

          if (chapterIndex !== -1) {
            setCurrentChapter(chapterIndex);
          }
        }

        // Load the words for this book
        const bookWords = await getWordsForBook(bookId);
        if (bookWords && bookWords.length > 0) {
          setWords(bookWords);
        } else {
          setError("Failed to load words for book");
        }
      } catch (err) {
        console.error("Error loading book:", err);
        setError("Error loading book");
      } finally {
        setIsLoading(false);
      }
    };

    if (bookId) {
      loadBook();
    }
  }, [bookId]);

  // Update book progress when word index changes
  const handleWordIndexChange = useCallback(
    async (index: number) => {
      setCurrentWordIndex(index);

      // Update current chapter if needed
      const newChapterIndex = chapters.findIndex(
        (chapter) => index >= chapter.startIndex && index <= chapter.endIndex
      );

      if (newChapterIndex !== -1 && newChapterIndex !== currentChapter) {
        setCurrentChapter(newChapterIndex);
      }

      // Save progress to IndexedDB (debounced in a real implementation)
      if (bookId) {
        await updateBookProgress(bookId, index);
      }
    },
    [bookId, chapters, currentChapter]
  );

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Handle reset
  const handleReset = async () => {
    setCurrentWordIndex(0);
    setIsPlaying(false);
    if (bookId) {
      await updateBookProgress(bookId, 0);
    }
  };

  // Handle WPM change
  const handleWpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWpm = parseInt(e.target.value);
    if (!isNaN(newWpm) && newWpm >= 100 && newWpm <= 1000) {
      setWpm(newWpm);
      // Save to localStorage
      localStorage.setItem("speedReaderWpm", newWpm.toString());
    }
  };

  // Handle chapter selection
  const handleChapterSelect = async (chapterIndex: number) => {
    const newIndex = chapters[chapterIndex].startIndex;
    setCurrentWordIndex(newIndex);
    setCurrentChapter(chapterIndex);
    setIsPlaying(false);

    if (bookId) {
      await updateBookProgress(bookId, newIndex);
    }
  };

  // Toggle dark mode
  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    document.documentElement.setAttribute(
      "data-theme",
      newMode ? "dark" : "light"
    );
    // Save to localStorage
    localStorage.setItem("speedReaderTheme", newMode ? "dark" : "light");
  };

  // Show loading state
  if (isLoading) {
    return <div className="book-loading">Loading book...</div>;
  }

  // Show error state
  if (error) {
    return (
      <div className="book-error">
        <p>{error}</p>
        {onBackToLibrary && (
          <button onClick={onBackToLibrary} className="back-to-library-btn">
            Back to Library
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="book-reader-container">
      <div className="book-reader">
        <div className="book-title">{bookTitle}</div>
        <WordReader
          words={words}
          currentWordIndex={currentWordIndex}
          isPlaying={isPlaying}
          wpm={wpm}
          onWordIndexChange={handleWordIndexChange}
          isDarkMode={isDarkMode}
        />
        <ReaderControls
          isPlaying={isPlaying}
          wpm={wpm}
          currentWordIndex={currentWordIndex}
          totalWords={words.length}
          onPlayPause={togglePlay}
          onReset={handleReset}
          onWpmChange={handleWpmChange}
          isDarkMode={isDarkMode}
          currentChapter={currentChapter}
          chapters={chapters}
          onChapterSelect={handleChapterSelect}
          fileName={fileName}
          onThemeToggle={toggleDarkMode}
        />
      </div>
    </div>
  );
};

export default BookReader;
