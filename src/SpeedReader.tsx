import React, { useState, useEffect, useCallback } from "react";
import FileInput from "./components/FileInput";
import ReaderControls from "./components/ReaderControls";
import Library from "./components/Library";
import StorageInfo from "./components/StorageInfo";
import { Chapter, Book } from "./types/reader";
import { createBookFromEpub } from "./helpers/epubHandler";
import {
  addBook,
  updateBookProgress,
  getBookById,
} from "./helpers/libraryManager";
import {
  saveWordsForBook,
  loadWordsForBook,
  createErrorWords,
  isStorageAvailable,
  debugStorageForBook,
  checkStorageUsage,
  cleanupStorage,
  clearWordsForBook,
} from "./helpers/wordStorage";
import { saveAppSettings, getAppSettings } from "./helpers/dexieDB";
import "./SpeedReader.css";
import "./styles/StorageInfo.css";

const isDevelopment = import.meta.env.DEV;

interface SpeedReaderProps {
  viewMode?: "reader" | "library";
  onNavigateToLibrary?: () => void;
  onNavigateToReader?: (bookId?: string) => void;
  initialBookId?: string | null;
}

const SpeedReader: React.FC<SpeedReaderProps> = ({
  viewMode = "library",
  onNavigateToLibrary,
  onNavigateToReader,
  initialBookId = null,
}) => {
  // State management
  const [currentView, setCurrentView] = useState<"reader" | "library">(
    viewMode
  );
  const [currentBookId, setCurrentBookId] = useState<string | null>(
    initialBookId
  );
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [libraryKey, setLibraryKey] = useState(Date.now());
  const [fileName, setFileName] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("speedReaderTheme");
    return (
      savedTheme === "dark" ||
      (savedTheme === null &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  const msPerWord = Math.floor(60000 / wpm);

  // Load initial settings
  useEffect(() => {
    const loadSettings = async () => {
      const settings = await getAppSettings();
      if (settings) {
        setWpm(settings.wpm);
        setIsDarkMode(settings.theme === "dark");
      }
    };
    loadSettings();
  }, []);

  // Handle file processing
  const handleFileProcessed = async (
    data: {
      text: string;
      words: string[];
      fileName: string;
      chapters: Chapter[];
    },
    file?: File
  ) => {
    if (!file) {
      console.error("No file provided");
      return;
    }

    try {
      const epubContent = { text: data.text, chapters: data.chapters };
      const book = await createBookFromEpub(file, epubContent);

      // Save the words for this book BEFORE adding it to the library
      const wordsSaved = await saveWordsForBook(book.id, data.words);
      if (!wordsSaved) {
        console.error("Failed to save words for book ID:", book.id);

        // Check storage usage
        const currentStorage = await checkStorageUsage();
        if (currentStorage.usedPercent > 90) {
          alert(
            "Warning: Storage is almost full. You may need to remove some books to add new ones."
          );
        }
      } else {
        await debugStorageForBook(book.id);
      }

      // Add book to library
      await addBook(book);

      // Force library refresh
      setLibraryKey(Date.now());

      console.log(
        "Book successfully added to library:",
        book.title,
        "with ID:",
        book.id
      );

      // Select the newly added book
      await handleSelectBook(book.id);
    } catch (error) {
      console.error("Error adding book to library:", error);
      alert(
        "There was an error adding the book to the library. Please try again."
      );
    }
  };

  // Handle book selection
  const handleSelectBook = async (bookId: string) => {
    try {
      const book = await getBookById(bookId);
      if (!book) {
        throw new Error(`Book not found with ID: ${bookId}`);
      }

      setCurrentBookId(bookId);
      setFileName(book.fileName);
      setCurrentWordIndex(book.currentWordIndex || 0);
      setChapters(book.chapters);

      // Load words for the book
      const loadedWords = await loadWordsForBook(bookId);
      if (loadedWords) {
        setWords(loadedWords);
        console.log(`Successfully loaded ${loadedWords.length} words for book`);

        // Navigate to reader view
        if (onNavigateToReader) {
          onNavigateToReader(bookId);
        } else {
          setCurrentView("reader");
        }
      } else {
        console.warn(`Failed to load words for book ID: ${bookId}`);

        if (!isStorageAvailable()) {
          alert(
            "Warning: Your browser's storage is not available. This may be why the book content couldn't be loaded."
          );
        }

        await promptForReupload(book);
      }
    } catch (error) {
      console.error("Error loading book:", error);
      alert("Error loading book. Please try again.");
    }
  };

  // Helper to show re-upload message
  const promptForReupload = async (book: Book) => {
    console.log(`Creating error message for book: ${book.id}`);
    const errorWords = await createErrorWords(book.id);
    setWords(errorWords);
    setCurrentView("reader");

    setTimeout(() => {
      alert(
        "The content for this book is not available in storage. Please re-upload the EPUB file to read it again. Your reading progress has been preserved."
      );
    }, 100);
  };

  // Handle chapter selection
  const handleChapterSelect = async (chapterIndex: number) => {
    setCurrentWordIndex(chapters[chapterIndex].startIndex);
    setCurrentChapter(chapterIndex);
    setIsPlaying(false);

    if (currentBookId) {
      await updateBookProgress(
        currentBookId,
        chapters[chapterIndex].startIndex
      );
    }
  };

  // Handle reset
  const handleReset = async () => {
    setCurrentWordIndex(0);
    setFileName("");
    setWords([]);
    setChapters([]);
    setIsPlaying(false);

    if (currentBookId) {
      await clearWordsForBook(currentBookId);
      setCurrentBookId(null);
      setCurrentView("library");
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
    localStorage.setItem("speedReaderTheme", newMode ? "dark" : "light");
    saveAppSettings({ theme: newMode ? "dark" : "light" });
  };

  // Auto-save progress
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentWordIndex < words.length) {
      const currentWord = words[currentWordIndex];
      const adjustedTime = msPerWord * (0.5 + currentWord.length / 8);

      interval = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);
            if (currentBookId) {
              updateBookProgress(currentBookId, prev);
            }
            return prev;
          }
          return prev + 1;
        });
      }, adjustedTime);
    }
    return () => clearInterval(interval);
  }, [
    isPlaying,
    currentWordIndex,
    words.length,
    msPerWord,
    words,
    currentBookId,
  ]);

  // Save settings when WPM changes
  useEffect(() => {
    const saveSettings = async () => {
      const settings = await getAppSettings();
      await saveAppSettings({
        ...settings,
        wpm,
      });
    };
    saveSettings();
  }, [wpm]);

  return (
    <div className="speed-reader">
      {currentView === "library" ? (
        <>
          <FileInput onFileProcessed={handleFileProcessed} />
          <Library key={libraryKey} onSelectBook={handleSelectBook} />
          {isDevelopment && <StorageInfo />}
        </>
      ) : (
        <ReaderControls
          isPlaying={isPlaying}
          wpm={wpm}
          currentWordIndex={currentWordIndex}
          totalWords={words.length}
          onPlayPause={() => setIsPlaying(!isPlaying)}
          onReset={handleReset}
          onWpmChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setWpm(Number(e.target.value))
          }
          isDarkMode={isDarkMode}
          currentChapter={currentChapter}
          chapters={chapters}
          onChapterSelect={handleChapterSelect}
          fileName={fileName}
          onThemeToggle={toggleDarkMode}
        />
      )}
    </div>
  );
};

export default SpeedReader;
