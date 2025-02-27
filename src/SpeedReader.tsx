import React, { useState, useEffect, useCallback } from "react";
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
import { processText } from "./helpers/textProcessor";
// keep an eye on the chapter order
// far off TODO: add a local TTS thingy with kokoro

interface SpeedReaderProps {
  viewMode?: "reader" | "library" | "text";
  onNavigateToLibrary?: () => void;
  onNavigateToReader?: (bookId?: string) => void;
  initialBookId?: string | null;
  initialText?: string;
  initialWords?: string[];
}

const SpeedReader: React.FC<SpeedReaderProps> = ({
  viewMode = "reader",
  onNavigateToLibrary,
  onNavigateToReader,
  initialBookId = null,
  initialText,
  initialWords,
}) => {
  // Development mode detection
  const isDevelopmentMode = import.meta.env.DEV === true;

  const [text, setText] = useState(
    "Welcome to Speed Reader! Upload your text to begin."
  );
  const [words, setWords] = useState<string[]>(() => {
    // No need to load words here now - it will be handled by useEffect
    return [];
  });
  const [currentWordIndex, setCurrentWordIndex] = useState(() => {
    // Initial value, will be replaced with settings from DB
    const savedProgress = localStorage.getItem("speedReaderProgress");
    return savedProgress ? parseInt(savedProgress, 10) : 0;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(() => {
    // Initial value, will be replaced with settings from DB
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
    // If there's no saved preference, use system preference
    if (savedTheme === null) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches;
    }
    return savedTheme === "dark";
  });

  const [inputType, setInputType] = useState<InputType>(() => {
    const savedType = localStorage.getItem("speedReaderInputType");
    return (savedType as InputType) || InputType.EPUB; // Default to EPUB instead of TEXT
  });

  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  // Replace the currentView state with the viewMode prop
  const [currentView, setCurrentView] = useState<"reader" | "library" | "text">(
    viewMode
  );

  // Use effect to update currentView when viewMode prop changes
  useEffect(() => {
    setCurrentView(viewMode);
  }, [viewMode]);

  // Add state for current book ID
  const [currentBookId, setCurrentBookId] = useState<string | null>(() => {
    return localStorage.getItem("speedReaderCurrentBookId");
  });

  // Add state to force library refresh when new books are added
  const [libraryKey, setLibraryKey] = useState<number>(Date.now());

  const msPerWord = Math.floor(60000 / wpm);

  // Load app settings from IndexedDB on init
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const settings = await getAppSettings();

        // Update state with settings from IndexedDB
        setWpm(settings.wpm);
        setIsDarkMode(settings.theme === "dark");

        // Check localStorage first for input type (for backward compatibility)
        const localStorageInputType = localStorage.getItem(
          "speedReaderInputType"
        );

        if (localStorageInputType) {
          // If localStorage has a value, use it and update IndexedDB to match
          const inputTypeValue = localStorageInputType as InputType;
          setInputType(inputTypeValue);

          // Make sure IndexedDB matches localStorage
          if (settings.inputType !== inputTypeValue) {
            saveAppSettings({ inputType: inputTypeValue });
          }
        } else {
          // If no localStorage value, use IndexedDB value and update localStorage
          const newInputType = settings.inputType as InputType;
          setInputType(newInputType);
          localStorage.setItem("speedReaderInputType", newInputType);
        }

        // Set input type and update view accordingly
        const newInputType = settings.inputType as InputType;
        setInputType(newInputType);

        // If in EPUB mode and no book is selected, force library view
        if (newInputType === InputType.EPUB) {
          const hasCurrentBook = !!localStorage.getItem(
            "speedReaderCurrentBookId"
          );
          if (!hasCurrentBook) {
            setCurrentView("library");
          }
        } else {
          // In TEXT mode, always default to reader view
          setCurrentView("reader");
        }

        // Save theme to localStorage if it doesn't exist
        if (localStorage.getItem("speedReaderTheme") === null) {
          localStorage.setItem("speedReaderTheme", settings.theme);
        }

        // Save inputType to localStorage if it doesn't exist
        if (localStorage.getItem("speedReaderInputType") === null) {
          localStorage.setItem("speedReaderInputType", settings.inputType);
        }

        console.log("App settings loaded from IndexedDB");
      } catch (error) {
        console.error("Error loading app settings from IndexedDB:", error);

        // If there's an error, make sure default values are saved
        if (localStorage.getItem("speedReaderTheme") === null) {
          const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches
            ? "dark"
            : "light";
          localStorage.setItem("speedReaderTheme", systemTheme);

          // Also save to IndexedDB
          saveAppSettings({ theme: systemTheme });
        }

        if (localStorage.getItem("speedReaderInputType") === null) {
          localStorage.setItem("speedReaderInputType", InputType.EPUB);

          // Also save to IndexedDB
          saveAppSettings({ inputType: InputType.EPUB });
        }
      }
    };

    loadSettings();

    // If initial text and words are provided, use them directly (for TextPage)
    if (initialText && initialWords && initialWords.length > 0) {
      console.log("Using provided initialText and initialWords");
      setText(initialText);
      setWords(initialWords);
      setCurrentWordIndex(0);
      setFileName("Text Input");
      setCurrentView("reader");
      return;
    }

    // If there's a current book, load its words
    if (currentBookId) {
      loadCurrentBookWords();
    }
  }, [initialText, initialWords]);

  // Load words for current book from IndexedDB
  const loadCurrentBookWords = async () => {
    if (!currentBookId) return;

    try {
      const loadedWords = await loadWordsForBook(currentBookId);

      if (loadedWords && loadedWords.length > 0) {
        setWords(loadedWords);
        console.log(`Loaded ${loadedWords.length} words for current book`);
      } else {
        console.warn("No words loaded for current book");
      }
    } catch (error) {
      console.error("Error loading words for current book:", error);
    }
  };

  const togglePlay = async () => {
    setIsPlaying((prev) => !prev);
    if (!isPlaying) {
      if (currentWordIndex >= words.length - 1) {
        // If we're at the end, start over
        setCurrentWordIndex(0);
      }

      if (currentBookId) {
        await updateBookProgress(currentBookId, currentWordIndex);
      }
    }
  };

  // Update WPM handler to save setting
  const handleWpmChange = useCallback(async (newWpm: number) => {
    setWpm(newWpm);

    // Save to localStorage for backward compatibility
    localStorage.setItem("speedReaderWpm", newWpm.toString());

    // Also save to IndexedDB
    try {
      await saveAppSettings({ wpm: newWpm });
    } catch (error) {
      console.error("Error saving WPM to IndexedDB:", error);
    }
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
        "Warning: Your browser's localStorage is not available or is full. That's okay, we'll use IndexedDB instead."
      );
      console.log("localStorage is not available, using IndexedDB only");
    }

    // Check storage usage
    const storageUsage = await checkStorageUsage();
    console.log(
      `Storage usage: ${storageUsage.usedPercent}% (${(storageUsage.used / 1024).toFixed(1)}KB used)`
    );

    // Attempt cleanup if storage is getting full
    if (storageUsage.usedPercent > 70) {
      console.log("Storage is getting full, attempting cleanup...");
      const cleaned = await cleanupStorage();
      if (cleaned) {
        console.log("Successfully cleaned up some storage space");
      }
    }

    // For TEXT mode, process differently than EPUB
    if (inputType === InputType.TEXT) {
      // Reset the current book first to avoid state contamination
      setCurrentBookId(null);

      // Set new file data
      setText(data.text);
      setWords(data.words);
      setFileName(data.fileName);

      // Reset current word index for new text
      setCurrentWordIndex(0);
      setIsPlaying(false);

      // Only update chapters if they exist
      if (data.chapters) {
        setChapters(data.chapters);
      } else {
        setChapters([]);
      }

      // For TEXT mode, just update localStorage without book ID
      localStorage.setItem("speedReaderWords", JSON.stringify(data.words));
      localStorage.setItem("speedReaderProgress", "0");
      localStorage.setItem("speedReaderFileName", data.fileName);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(data.chapters || [])
      );
      localStorage.setItem("speedReaderCurrentChapter", "0");

      // Switch to reader view for TEXT mode
      setCurrentView("reader");
    }
    // For EPUB mode
    else if (inputType === InputType.EPUB && file) {
      try {
        const epubContent = { text: data.text, chapters: data.chapters || [] };
        const book = await createBookFromEpub(file, epubContent);

        // Explicitly save the words for this book BEFORE adding it to the library
        // This is a critical step to fix the issue
        const wordsSaved = await saveWordsForBook(book.id, data.words);
        if (!wordsSaved) {
          console.error("Failed to save words for book ID:", book.id);

          // Check if we're out of storage space
          const currentStorage = await checkStorageUsage();
          if (currentStorage.usedPercent > 90) {
            alert(
              "Warning: Storage is almost full. You may need to remove some books to add new ones."
            );
          }
        } else {
          // Debug storage after saving
          await debugStorageForBook(book.id);
        }

        // Add book to library
        await addBook(book);

        // Force library refresh by updating the key
        setLibraryKey(Date.now());

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
        const wordsSaved = await saveWordsForBook(fallbackBook.id, data.words);
        if (!wordsSaved) {
          console.error(
            "Failed to save words for fallback book ID:",
            fallbackBook.id
          );

          // Check if we're out of storage space
          const currentStorage = await checkStorageUsage();
          if (currentStorage.usedPercent > 90) {
            alert(
              "Warning: Storage is almost full. You may need to remove some books to add new ones."
            );
          }
        } else {
          // Debug storage after saving
          await debugStorageForBook(fallbackBook.id);
        }

        // Add fallback book to library
        await addBook(fallbackBook);

        // Force library refresh
        setLibraryKey(Date.now());

        console.log("Fallback book added to library with ID:", fallbackBook.id);
      }
    }
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
  const handleChapterSelect = async (chapterIndex: number) => {
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
      await updateBookProgress(
        currentBookId,
        chapters[chapterIndex].startIndex
      );
    }
  };

  // Update handleReset to handle both EPUB and TEXT modes
  const handleReset = async () => {
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
        await clearWordsForBook(currentBookId);
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
    // Set the theme on both documentElement and for CSS variables
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );

    // Also add a class to the speed-reader-container
    document.documentElement.classList.toggle("dark-mode", isDarkMode);

    // Save to localStorage
    localStorage.setItem("speedReaderTheme", isDarkMode ? "dark" : "light");

    // Also save to IndexedDB
    saveAppSettings({ theme: isDarkMode ? "dark" : "light" });
  }, [isDarkMode]);

  const handleInputTypeChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newType = e.target.value as InputType;
    setInputType(newType);
    localStorage.setItem("speedReaderInputType", newType);

    // Save to IndexedDB
    await saveAppSettings({ inputType: newType });

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
      const book = await getBookById(bookId);
      if (!book) {
        console.error("Book not found:", bookId);
        alert("Error: Book not found in library");
        return;
      }

      // Debug storage for this book
      await debugStorageForBook(bookId);

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

      // Load words from IndexedDB using our helper function
      console.log(`Loading words for book ID: ${bookId}`);
      const loadedWords = await loadWordsForBook(bookId);

      if (loadedWords) {
        setWords(loadedWords);
        console.log(`Successfully loaded ${loadedWords.length} words for book`);

        // After loading the book, navigate to reader view
        if (onNavigateToReader) {
          onNavigateToReader(bookId);
        } else {
          setCurrentView("reader");
        }
      } else {
        console.warn(`Failed to load words for book ID: ${bookId}`);

        // Check whether localStorage is available before attempting re-upload
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

    // Use our new helper to create error words
    const errorWords = await createErrorWords(book.id);

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

  // Update the toggleView function
  const toggleView = async () => {
    if (currentView === "reader") {
      // Set any state needed before navigation
      setIsPlaying(false);

      // Use the navigation callback if provided
      if (onNavigateToLibrary) {
        onNavigateToLibrary();
      } else {
        setCurrentView("library");
      }
    } else {
      // We're in library view, switch to reader
      if (onNavigateToReader) {
        // Only pass the currentBookId if it exists
        if (currentBookId) {
          onNavigateToReader(currentBookId);
        } else {
          onNavigateToReader();
        }
      } else {
        setCurrentView("reader");
      }
    }
  };

  // Replace the existing useEffect for first load with this:
  useEffect(() => {
    // Use a different flag specifically for first-time user detection
    const hasVisitedBefore = localStorage.getItem("speedReaderFirstVisit");

    if (!hasVisitedBefore) {
      // First time user - set EPUB mode and library view
      setInputType(InputType.EPUB);
      localStorage.setItem("speedReaderInputType", InputType.EPUB);
      setCurrentView("library");

      // Mark that we've set initial preferences
      localStorage.setItem("speedReaderFirstVisit", "true");
    }
  }, []);

  // Update the initialBookId useEffect
  useEffect(() => {
    if (initialBookId && initialBookId !== currentBookId) {
      console.log(`Loading initial book from URL parameter: ${initialBookId}`);
      handleSelectBook(initialBookId);
    }
  }, [initialBookId, currentBookId, handleSelectBook]);

  return (
    <div className={`speed-reader-container ${isDarkMode ? "dark-mode" : ""}`}>
      {/* Conditionally render based on the view mode */}
      {currentView === "library" ? (
        <div className="library-view">
          <Library onSelectBook={handleSelectBook} refreshKey={libraryKey} />

          {/* Restore the library-upload-container */}
          <div className="library-upload-container">
            <h3>Add a new book</h3>
            <FileInput
              inputType={InputType.EPUB}
              onFileProcessed={handleFileProcessed}
            />
            {isDevelopmentMode && <StorageInfo showDetailed={true} />}
          </div>
        </div>
      ) : currentView === "text" ? (
        <div className="text-input-view">
          <h2>Text Input</h2>
          <p className="text-description">
            Enter or paste your text below to start speed reading
          </p>

          <div className="text-editor">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Enter or paste your text here..."
              rows={10}
            ></textarea>

            <button
              className="start-reading-btn"
              onClick={() => {
                const processedWords = processText(text);
                handleFileProcessed({
                  text: text,
                  words: processedWords,
                  fileName: "Manual Text Input",
                });
                if (onNavigateToReader) {
                  onNavigateToReader();
                } else {
                  setCurrentView("reader");
                }
              }}
            >
              Start Reading
            </button>
          </div>

          <div className="separator">or</div>

          <div className="file-upload-section">
            <FileInput
              inputType={InputType.TEXT}
              onFileProcessed={handleFileProcessed}
            />
          </div>
        </div>
      ) : (
        // Reader view (default)
        <div className="reader-view">
          {/* Restore input type selector and dark mode toggle */}
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

            {isDevelopmentMode && <StorageInfo showDetailed={false} />}
          </div>

          {/* Text Display */}
          <div className="text-display">
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
          </div>

          {/* File Input */}
          {chapters.length === 0 && (
            <FileInput
              inputType={inputType}
              onFileProcessed={handleFileProcessed}
            />
          )}

          {/* Controls */}
          <ReaderControls
            isPlaying={isPlaying}
            wpm={wpm}
            currentWordIndex={currentWordIndex}
            totalWords={words.length}
            onPlayPause={togglePlay}
            onReset={handleReset}
            onWpmChange={handleWpmInputChange}
            isDarkMode={isDarkMode}
            currentChapter={currentChapter}
            chapters={chapters}
            onChapterSelect={handleChapterSelect}
            fileName={fileName}
            onThemeToggle={() => setIsDarkMode(!isDarkMode)}
          />
        </div>
      )}
    </div>
  );
};

export default SpeedReader;
