import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import FileInput from "./components/FileInput";
import ReaderControls from "./components/ReaderControls";
import { Chapter, InputType } from "./types/reader";
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

  const msPerWord = Math.floor(60000 / wpm);

  const togglePlay = useCallback(() => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    if (!newPlayState) {
      localStorage.setItem("speedReaderProgress", currentWordIndex.toString());
      localStorage.setItem("speedReaderWords", JSON.stringify(words));
    }
  }, [isPlaying, currentWordIndex, words]);

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
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);

    return () => {
      document.removeEventListener("keydown", handleKeyPress);
    };
  }, [togglePlay, handleWpmChange, wpm]);

  // Update the input handler to use the new handleWpmChange
  const handleWpmInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleWpmChange(Number(e.target.value));
  };

  // Save progress when uploading new file
  const handleFileProcessed = async (data: {
    text: string;
    words: string[];
    fileName: string;
    chapters?: Chapter[];
  }) => {
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
  };

  // Update handleReset to clear chapters
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
            return prev;
          }
          return prev + 1;
        });
      }, adjustedTime);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentWordIndex, words.length, msPerWord, words]);

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
    handleReset(); // Reset the reader when changing input type
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
      </div>

      <div className="word-display">
        <span className="current-word">
          {words[currentWordIndex] || "Ready"}
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

      <FileInput inputType={inputType} onFileProcessed={handleFileProcessed} />
    </div>
  );
};

export default SpeedReader;
