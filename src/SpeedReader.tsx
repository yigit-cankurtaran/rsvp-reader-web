import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import FileInput from "./components/FileInput";
import ReaderControls from "./components/ReaderControls";
import Library from "./components/Library";
import { Chapter, InputType } from "./types/reader";
import { createBookFromEpub } from "./helpers/epubHandler";
import {
  addBook,
  updateBookProgress,
  getBookById,
} from "./helpers/libraryManager";
import "./SpeedReader.css";
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

        // Save words for this specific book
        localStorage.setItem(
          `speedReaderWords_${currentBookId}`,
          JSON.stringify(words)
        );
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
    setText(data.text);
    setWords(data.words);
    setFileName(data.fileName);
    localStorage.setItem("speedReaderWords", JSON.stringify(data.words));
    localStorage.setItem("speedReaderProgress", "0");
    localStorage.setItem("speedReaderFileName", data.fileName);
    setCurrentWordIndex(0);
    setIsPlaying(false);

    if (data.chapters) {
      setChapters(data.chapters);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(data.chapters)
      );
    }

    // If it's an EPUB file, add it to the library
    if (inputType === InputType.EPUB && file) {
      try {
        const epubContent = { text: data.text, chapters: data.chapters || [] };
        const book = await createBookFromEpub(file, epubContent);
        addBook(book);
        setCurrentBookId(book.id);
        localStorage.setItem("speedReaderCurrentBookId", book.id);

        // Save words for this specific book
        localStorage.setItem(
          `speedReaderWords_${book.id}`,
          JSON.stringify(data.words)
        );
      } catch (error) {
        console.error("Error adding book to library:", error);
      }
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
      const book = getBookById(bookId);
      if (!book) return;

      setCurrentBookId(bookId);
      localStorage.setItem("speedReaderCurrentBookId", bookId);

      // Load book data
      setFileName(book.fileName);
      localStorage.setItem("speedReaderFileName", book.fileName);

      // Load chapters
      setChapters(book.chapters);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(book.chapters)
      );

      // Set current word index to saved progress
      setCurrentWordIndex(book.currentWordIndex);
      localStorage.setItem(
        "speedReaderProgress",
        book.currentWordIndex.toString()
      );

      // Update current chapter based on word index
      const chapterIndex = book.chapters.findIndex(
        (chapter) =>
          book.currentWordIndex >= chapter.startIndex &&
          book.currentWordIndex <= chapter.endIndex
      );

      if (chapterIndex !== -1) {
        setCurrentChapter(chapterIndex);
        localStorage.setItem(
          "speedReaderCurrentChapter",
          chapterIndex.toString()
        );
      }

      // Load words from localStorage if available
      const savedWords = localStorage.getItem(`speedReaderWords_${bookId}`);
      if (savedWords) {
        setWords(JSON.parse(savedWords));
      } else {
        // If words aren't cached, we need to reload the file
        // This is a limitation of the current implementation
        // In a real app, we would store the processed text in IndexedDB
        alert("Please re-upload the EPUB file to continue reading.");
        return;
      }

      // Switch to reader view
      setCurrentView("reader");
    } catch (error) {
      console.error("Error loading book:", error);
      alert("Error loading book. Please try again.");
    }
  };

  // Add a toggle for switching between reader and library views
  const toggleView = () => {
    const newView = currentView === "reader" ? "library" : "reader";
    setCurrentView(newView);

    // Save progress when switching to library
    if (newView === "library" && currentBookId) {
      updateBookProgress(currentBookId, currentWordIndex);
    }
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
            <Library onSelectBook={handleSelectBook} />

            <div className="library-upload-container">
              <h3>Add a new book</h3>
              <FileInput
                inputType={InputType.EPUB}
                onFileProcessed={handleFileProcessed}
              />
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
