import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import FileInput from "./components/FileInput";
import ReaderControls from "./components/ReaderControls";
import Library from "./components/Library";
import StorageInfo from "./components/StorageInfo";
import { Chapter, InputType, Book } from "./types/reader";
import { createBookFromEpub } from "./helpers/epubHandler";
import {
  addBook,
  updateBookProgress,
  getBookById,
} from "./helpers/libraryManager";
import { processText } from "./helpers/textProcessor";
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
import "./SpeedReader.css";
import "./styles/StorageInfo.css";
// keep an eye on the chapter order
// far off TODO: add a local TTS thingy with kokoro

const SpeedReader = () => {
  const [text, setText] = useState(
    "Welcome to Speed Reader! Upload your text to begin."
  );
  const [words, setWords] = useState<string[]>(() => {
    const savedWords = localStorage.getItem("speedReaderWords");
    return savedWords ? JSON.parse(savedWords) : [];
  });
  const [currentWordIndex, setCurrentWordIndex] = useState(() => {
    // Try to load saved progress from localStorage
    const savedProgress = localStorage.getItem("speedReaderProgress");
    return savedProgress ? parseInt(savedProgress, 10) : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(() => {
    const savedWpm = localStorage.getItem("speedReaderWpm");
    return savedWpm ? parseInt(savedWpm, 10) : 300;
  });

  const [fileName, setFileName] = useState(() => {
    return localStorage.getItem("speedReaderFileName") || "";
  });

  const [chapters, setChapters] = useState<Chapter[]>(() => {
    const savedChapters = localStorage.getItem("speedReaderChapters");
    return savedChapters ? JSON.parse(savedChapters) : [];
  });

  const [currentChapter, setCurrentChapter] = useState(() => {
    const savedChapter = localStorage.getItem("speedReaderCurrentChapter");
    return savedChapter ? parseInt(savedChapter, 10) : 0;
  });

  const [isDarkMode, setIsDarkMode] = useState(() => {
    const savedTheme = localStorage.getItem("speedReaderTheme");
    return savedTheme === "dark";
  });

  const [inputType, setInputType] = useState<InputType>(() => {
    const savedType = localStorage.getItem("speedReaderInputType");
    return (savedType as InputType) || InputType.TEXT;
  });

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  // Add state for current view (reader or library)
  const [currentView, setCurrentView] = useState<"reader" | "library">(() => {
    // If we have a book loaded, show reader, otherwise show library
    return words.length > 0 ? "reader" : "library";
  });

  // Add state for current book ID
  const [currentBookId, setCurrentBookId] = useState<string | null>(() => {
    return localStorage.getItem("speedReaderCurrentBookId");
  });

  // Add state to force library refresh when new books are added
  const [libraryKey, setLibraryKey] = useState<number>(Date.now());

  const msPerWord = Math.floor(60000 / wpm);

  const togglePlay = useCallback(() => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    if (!newPlayState) {
      localStorage.setItem("speedReaderProgress", currentWordIndex.toString());
      localStorage.setItem("speedReaderWords", JSON.stringify(words));

      // Update book progress in library
      if (currentBookId) {
        updateBookProgress(currentBookId, currentWordIndex);

        // Save words for this specific book using our helper
        saveWordsForBook(currentBookId, words);
      }
    }
  }, [isPlaying, currentWordIndex, words, currentBookId]);

  // Update WPM handler to save setting
  const handleWpmChange = useCallback((newWpm: number) => {
    setWpm(newWpm);
    localStorage.setItem("speedReaderWpm", newWpm.toString());
  }, []);

  // Add keyboard control handler
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.target === document.body) {
        switch (event.code) {
          case "Space":
            event.preventDefault();
            togglePlay();
            break;
          case "ArrowLeft":
            event.preventDefault();
            handleWpmChange(Math.max(50, wpm - 50));
            break;
          case "ArrowRight":
            event.preventDefault();
            handleWpmChange(Math.min(1000, wpm + 50));
            break;
          case "Escape":
            // Go back to library view when pressing Escape
            if (currentView === "reader") {
              setCurrentView("library");
              setIsPlaying(false);

              // Save progress before going back to library
              if (currentBookId) {
                updateBookProgress(currentBookId, currentWordIndex);
              }
            }
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [
    togglePlay,
    handleWpmChange,
    wpm,
    currentView,
    currentBookId,
    currentWordIndex,
  ]);

  // Update the input handler to use the new handleWpmChange
  const handleWpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleWpmChange(Number(e.target.value));
  };

  // Save progress when uploading new file
  const handleFileProcessed = async (
    data: {
      text: string;
      words: string[];
      fileName: string;
      chapters?: Chapter[];
    },
    file?: File
  ) => {
    console.log(
      "Processing file:",
      data.fileName,
      "Words count:",
      data.words.length
    );

    // Check if localStorage is available
    if (!isStorageAvailable()) {
      alert(
        "Warning: Your browser's localStorage is not available or is full. Your reading progress and books may not be saved."
      );
      console.error("localStorage is not available");
    }

    // Check storage usage
    const storageUsage = checkStorageUsage();
    console.log(
      `Storage usage: ${storageUsage.usedPercent}% (${(storageUsage.used / 1024).toFixed(1)}KB used)`
    );

    // Attempt cleanup if storage is getting full
    if (storageUsage.usedPercent > 70) {
      console.log("Storage is getting full, attempting cleanup...");
      const cleaned = cleanupStorage();
      if (cleaned) {
        console.log("Successfully cleaned up some storage space");
      }
    }

    // Reset the current book first to avoid state contamination
    setCurrentBookId(null);

    // Set new file data
    setText(data.text);
    setWords(data.words);
    setFileName(data.fileName);

    // Reset current word index for new book
    setCurrentWordIndex(0);
    setIsPlaying(false);

    // Only update chapters if they exist
    if (data.chapters) {
      setChapters(data.chapters);
    } else {
      setChapters([]);
    }

    // If it's an EPUB file, add it to the library
    if (inputType === InputType.EPUB && file) {
      try {
        const epubContent = { text: data.text, chapters: data.chapters || [] };
        const book = await createBookFromEpub(file, epubContent);

        // Explicitly save the words for this book BEFORE adding it to the library
        // This is a critical step to fix the issue
        const wordsSaved = saveWordsForBook(book.id, data.words);
        if (!wordsSaved) {
          console.error("Failed to save words for book ID:", book.id);

          // Check if we're out of storage space
          const currentStorage = checkStorageUsage();
          if (currentStorage.usedPercent > 90) {
            alert(
              "Warning: Your browser's localStorage is almost full. You may need to remove some books to add new ones."
            );
          }
        } else {
          // Debug storage after saving
          debugStorageForBook(book.id);
        }

        // Add book to library
        addBook(book);

        // Force library refresh by updating the key
        setLibraryKey(Date.now());

        // Set the current book ID to the new book
        setCurrentBookId(book.id);

        // Save book-specific data in localStorage
        localStorage.setItem("speedReaderCurrentBookId", book.id);
        localStorage.setItem("speedReaderProgress", "0");
        localStorage.setItem("speedReaderFileName", data.fileName);
        localStorage.setItem(
          "speedReaderChapters",
          JSON.stringify(data.chapters || [])
        );
        localStorage.setItem("speedReaderCurrentChapter", "0");

        console.log(
          "Book successfully added to library:",
          book.title,
          "with ID:",
          book.id
        );
      } catch (error) {
        console.error("Error adding book to library:", error);

        // Even if there was an error, still create a fallback book
        const fallbackBook = {
          id: `book_${Date.now()}`,
          fileName: file.name,
          title: file.name.replace(/\.epub$/i, "").replace(/_/g, " "),
          author: "Unknown",
          coverUrl: null,
          totalWords: data.words.length,
          currentWordIndex: 0,
          lastReadDate: new Date().toISOString(),
          chapters: data.chapters || [],
        };

        // Save the words for the fallback book BEFORE adding it to the library
        const wordsSaved = saveWordsForBook(fallbackBook.id, data.words);
        if (!wordsSaved) {
          console.error(
            "Failed to save words for fallback book ID:",
            fallbackBook.id
          );

          // Check if we're out of storage space
          const currentStorage = checkStorageUsage();
          if (currentStorage.usedPercent > 90) {
            alert(
              "Warning: Your browser's localStorage is almost full. You may need to remove some books to add new ones."
            );
          }
        } else {
          // Debug storage after saving
          debugStorageForBook(fallbackBook.id);
        }

        // Add fallback book to library
        addBook(fallbackBook);

        // Force library refresh
        setLibraryKey(Date.now());

        // Set current book ID to fallback book
        setCurrentBookId(fallbackBook.id);

        // Save fallback book data
        localStorage.setItem("speedReaderCurrentBookId", fallbackBook.id);
        localStorage.setItem("speedReaderProgress", "0");
        localStorage.setItem("speedReaderFileName", data.fileName);
        localStorage.setItem(
          "speedReaderChapters",
          JSON.stringify(data.chapters || [])
        );
        localStorage.setItem("speedReaderCurrentChapter", "0");

        console.log("Fallback book added to library with ID:", fallbackBook.id);
      }
    } else {
      // For TEXT mode, just update localStorage without book ID
      localStorage.setItem("speedReaderWords", JSON.stringify(data.words));
      localStorage.setItem("speedReaderProgress", "0");
      localStorage.setItem("speedReaderFileName", data.fileName);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(data.chapters || [])
      );
      localStorage.setItem("speedReaderCurrentChapter", "0");
    }

    // Switch to reader view
    setCurrentView("reader");
  };

  // Add a function to update current chapter based on word index
  const updateCurrentChapter = useCallback(
    (wordIndex: number) => {
      const newChapterIndex = chapters.findIndex(
        (chapter) =>
          wordIndex >= chapter.startIndex && wordIndex <= chapter.endIndex
      );

      if (newChapterIndex !== -1 && newChapterIndex !== currentChapter) {
        setCurrentChapter(newChapterIndex);
        localStorage.setItem(
          "speedReaderCurrentChapter",
          newChapterIndex.toString()
        );
      }
    },
    [chapters, currentChapter]
  );

  // Update the useEffect to check for chapter changes
  useEffect(() => {
    updateCurrentChapter(currentWordIndex);
  }, [currentWordIndex, updateCurrentChapter]);

  // Add chapter selection handler
  const handleChapterSelect = (chapterIndex: number) => {
    setCurrentWordIndex(chapters[chapterIndex].startIndex);
    setCurrentChapter(chapterIndex);
    localStorage.setItem(
      "speedReaderProgress",
      chapters[chapterIndex].startIndex.toString()
    );
    localStorage.setItem("speedReaderCurrentChapter", chapterIndex.toString());
    setIsPlaying(false);

    // Update book progress in library
    if (currentBookId) {
      updateBookProgress(currentBookId, chapters[chapterIndex].startIndex);
    }
  };

  // Update handleReset to handle both EPUB and TEXT modes
  const handleReset = () => {
    setCurrentWordIndex(0);
    setFileName("");
    setWords([]);
    setChapters([]);
    localStorage.removeItem("speedReaderProgress");
    localStorage.removeItem("speedReaderWords");
    localStorage.removeItem("speedReaderFileName");
    localStorage.removeItem("speedReaderChapters");
    localStorage.removeItem("speedReaderCurrentChapter");
    setIsPlaying(false);

    if (inputType === InputType.EPUB) {
      // For EPUB mode, clear current book ID and switch to library view
      if (currentBookId) {
        // Clear words for the current book
        clearWordsForBook(currentBookId);
      }
      localStorage.removeItem("speedReaderCurrentBookId");
      setCurrentBookId(null);
      setCurrentView("library");
    }
    // For TEXT mode, stay in reader view
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentWordIndex < words.length) {
      const currentWord = words[currentWordIndex];
      // Adjust time based on word length
      const adjustedTime = msPerWord * (0.5 + currentWord.length / 8);

      interval = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);

            // Update book progress in library when finished
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

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    localStorage.setItem("speedReaderTheme", isDarkMode ? "dark" : "light");
  }, [isDarkMode]);

  const handleInputTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = e.target.value as InputType;
    setInputType(newType);
    localStorage.setItem("speedReaderInputType", newType);

    // Reset the reader when changing input type
    setCurrentWordIndex(0);
    setWords([]);
    setFileName("");
    setChapters([]);
    localStorage.removeItem("speedReaderProgress");
    localStorage.removeItem("speedReaderWords");
    localStorage.removeItem("speedReaderFileName");
    localStorage.removeItem("speedReaderChapters");
    localStorage.removeItem("speedReaderCurrentChapter");

    if (newType === InputType.EPUB) {
      // Switch to library view when selecting EPUB
      setCurrentView("library");
      // Don't clear currentBookId when switching to EPUB
    } else {
      // For TEXT mode, always show reader view and clear book ID
      setCurrentView("reader");
      setCurrentBookId(null);
      localStorage.removeItem("speedReaderCurrentBookId");
    }

    setIsPlaying(false);
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Add this helper function
  const getDisplayWords = useCallback(
    (currentIndex: number) => {
      if (!words.length) return { prev: "", current: "Ready", next: "" };

      const currentWord = words[currentIndex];
      const prevWord = words[currentIndex - 1];
      const nextWord = words[currentIndex + 1];

      // Handle long words more aggressively
      const isLongWord = (word: string) => word && word.length > 8;

      // If current word is long, show it alone
      if (isLongWord(currentWord)) {
        return {
          prev: "",
          current: currentWord,
          next: "",
        };
      }

      // If previous or next word is long, show only two words
      if (isLongWord(prevWord)) {
        return {
          prev: "",
          current: currentWord,
          next: nextWord || "",
        };
      }

      if (isLongWord(nextWord)) {
        return {
          prev: prevWord || "",
          current: currentWord,
          next: "",
        };
      }

      // Default: show all three words if they're all short
      return {
        prev: prevWord || "",
        current: currentWord,
        next: nextWord || "",
      };
    },
    [words]
  );

  // Add handler for book selection from library
  const handleSelectBook = async (bookId: string) => {
    try {
      console.log(`Selecting book with ID: ${bookId}`);
      const book = getBookById(bookId);
      if (!book) {
        console.error("Book not found:", bookId);
        alert("Error: Book not found in library");
        return;
      }

      // Debug storage for this book
      debugStorageForBook(bookId);

      // Store the ID for the currently selected book
      setCurrentBookId(bookId);
      localStorage.setItem("speedReaderCurrentBookId", bookId);
      console.log("Book found:", book.title);

      // Load book metadata
      setFileName(book.fileName);
      localStorage.setItem("speedReaderFileName", book.fileName);

      // Load chapters
      setChapters(book.chapters || []);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(book.chapters || [])
      );

      // Set current word index to saved progress
      setCurrentWordIndex(book.currentWordIndex || 0);
      localStorage.setItem(
        "speedReaderProgress",
        (book.currentWordIndex || 0).toString()
      );

      // Update current chapter based on word index
      let chapterIndex = 0;
      if (book.chapters && book.chapters.length > 0) {
        chapterIndex = book.chapters.findIndex(
          (chapter) =>
            book.currentWordIndex >= chapter.startIndex &&
            book.currentWordIndex <= chapter.endIndex
        );

        // If no matching chapter found, default to first chapter
        if (chapterIndex === -1) chapterIndex = 0;
      }

      setCurrentChapter(chapterIndex);
      localStorage.setItem(
        "speedReaderCurrentChapter",
        chapterIndex.toString()
      );

      // Load words from localStorage using our helper function
      console.log(`Loading words for book ID: ${bookId}`);
      const loadedWords = loadWordsForBook(bookId);

      if (loadedWords) {
        setWords(loadedWords);
        console.log(`Successfully loaded ${loadedWords.length} words for book`);

        // Switch to reader view
        setCurrentView("reader");
      } else {
        console.warn(`Failed to load words for book ID: ${bookId}`);

        // Check whether localStorage is available before attempting re-upload
        if (!isStorageAvailable()) {
          alert(
            "Warning: Your browser's localStorage is not available. This may be why the book content couldn't be loaded."
          );
        }

        promptForReupload(book);
      }
    } catch (error) {
      console.error("Error loading book:", error);
      alert("Error loading book. Please try again.");
    }
  };

  // Helper to show re-upload message
  const promptForReupload = (book: Book) => {
    console.log(`Creating error message for book: ${book.id}`);

    // Use our new helper to create error words
    const errorWords = createErrorWords(book.id);

    // Set these words in state
    setWords(errorWords);
    console.log(`Created error words for book ID: ${book.id}`);

    // Switch to reader view to show the message
    setCurrentView("reader");

    // Show dialog to user with a small delay to ensure UI updates first
    setTimeout(() => {
      alert(
        "The content for this book is not available in storage. Please re-upload the EPUB file to read it again. Your reading progress has been preserved."
      );
    }, 100);
  };

  // Add a toggle for switching between reader and library views
  const toggleView = () => {
    const newView = currentView === "reader" ? "library" : "reader";

    // Save progress when switching to library
    if (newView === "library" && currentBookId) {
      // Update book progress in the library
      updateBookProgress(currentBookId, currentWordIndex);

      // Refresh the library to show updated progress
      setLibraryKey(Date.now());

      // Log state information for debugging
      console.log(
        `Switching to library view. Current book ID: ${currentBookId}, Progress: ${currentWordIndex}`
      );
    } else if (newView === "reader") {
      // Verify we have a valid book to read when going back to reader
      if (!currentBookId) {
        console.log("No book selected, remaining in library view");
        alert("Please select a book to read first.");
        return;
      }
      console.log(
        `Switching to reader view. Current book ID: ${currentBookId}`
      );
    }

    setCurrentView(newView);
  };

  return (
    <div className="reader-container">
      <div className="input-type-selector">
        <label htmlFor="input-type">Reading Mode:</label>
        <select
          id="input-type"
          value={inputType}
          onChange={handleInputTypeChange}
          className="input-type-select"
        >
          <option value={InputType.EPUB}>eBook (EPUB)</option>
          <option value={InputType.TEXT}>Plain Text</option>
        </select>

        {inputType === InputType.EPUB && (
          <button className="view-toggle-btn" onClick={toggleView}>
            {currentView === "reader" ? "View Library" : "Back to Reader"}
          </button>
        )}

        <StorageInfo showDetailed={false} />
      </div>

      {inputType === InputType.EPUB ? (
        // EPUB Mode
        currentView === "reader" ? (
          // Reader View for EPUB
          <>
            <div className="word-display">
              <span className="word first-word">
                {getDisplayWords(currentWordIndex).prev}
              </span>
              <span className={`word ${!isMobile ? "current-word" : ""}`}>
                {getDisplayWords(currentWordIndex).current}
              </span>
              <span className={`word ${isMobile ? "current-word" : ""}`}>
                {getDisplayWords(currentWordIndex).next}
              </span>
            </div>

            <ReaderControls
              isPlaying={isPlaying}
              wpm={wpm}
              currentChapter={currentChapter}
              chapters={chapters}
              currentWordIndex={currentWordIndex}
              totalWords={words.length}
              fileName={fileName}
              isDarkMode={isDarkMode}
              onPlayPause={togglePlay}
              onReset={handleReset}
              onWpmChange={handleWpmInputChange}
              onChapterSelect={handleChapterSelect}
              onThemeToggle={() => setIsDarkMode(!isDarkMode)}
            />

            {words.length === 0 && (
              <FileInput
                inputType={InputType.EPUB}
                onFileProcessed={handleFileProcessed}
              />
            )}
          </>
        ) : (
          // Library View for EPUB
          <>
            <Library key={libraryKey} onSelectBook={handleSelectBook} />

            <div className="library-upload-container">
              <h3>Add a new book</h3>
              <FileInput
                inputType={InputType.EPUB}
                onFileProcessed={handleFileProcessed}
              />
              <StorageInfo showDetailed={true} />
            </div>
          </>
        )
      ) : (
        // TEXT Mode - Always show reader view with text input
        <>
          <div className="word-display">
            <span className="word first-word">
              {getDisplayWords(currentWordIndex).prev}
            </span>
            <span className={`word ${!isMobile ? "current-word" : ""}`}>
              {getDisplayWords(currentWordIndex).current}
            </span>
            <span className={`word ${isMobile ? "current-word" : ""}`}>
              {getDisplayWords(currentWordIndex).next}
            </span>
          </div>

          <ReaderControls
            isPlaying={isPlaying}
            wpm={wpm}
            currentChapter={currentChapter}
            chapters={chapters}
            currentWordIndex={currentWordIndex}
            totalWords={words.length}
            fileName={fileName}
            isDarkMode={isDarkMode}
            onPlayPause={togglePlay}
            onReset={handleReset}
            onWpmChange={handleWpmInputChange}
            onChapterSelect={handleChapterSelect}
            onThemeToggle={() => setIsDarkMode(!isDarkMode)}
          />

          {/* Always show text input for TEXT mode */}
          <FileInput
            inputType={InputType.TEXT}
            onFileProcessed={handleFileProcessed}
          />
        </>
      )}
    </div>
  );
};

export default SpeedReader;
