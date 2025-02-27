import React, { useState, useEffect } from "react";
import { TextReaderProps, Chapter, InputType } from "../types/reader";
import { processText } from "../helpers/textProcessor";
import WordReader from "./WordReader";
import ReaderControls from "./ReaderControls";
import FileInput from "./FileInput";

const TextReader: React.FC<TextReaderProps> = ({
  initialText = "",
  initialWords = [],
  fileName = "Text Input",
}) => {
  // Reader state
  const [text, setText] = useState(initialText);
  const [words, setWords] = useState<string[]>(initialWords);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(() => {
    // Load WPM from localStorage or use default
    const savedWpm = localStorage.getItem("speedReaderWpm");
    return savedWpm ? parseInt(savedWpm, 10) : 300;
  });
  const [currentFileName, setCurrentFileName] = useState(fileName);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Load theme from localStorage or use system preference
    const savedTheme = localStorage.getItem("speedReaderTheme");
    return (
      savedTheme === "dark" ||
      (savedTheme === null &&
        document.documentElement.getAttribute("data-theme") === "dark")
    );
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);

  // Initialize theme from localStorage on component mount
  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
  }, []);

  // Initialize the reader with initial values if provided
  useEffect(() => {
    if (
      initialText &&
      initialText.trim().length > 0 &&
      initialWords.length === 0
    ) {
      const processedWords = processText(initialText);
      setWords(processedWords);
    } else if (initialWords && initialWords.length > 0) {
      setWords(initialWords);
    }

    if (fileName) {
      setCurrentFileName(fileName);
    }
  }, [initialText, initialWords, fileName]);

  // Toggle play/pause
  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  // Handle reset
  const handleReset = () => {
    setCurrentWordIndex(0);
    setIsPlaying(false);
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
  const handleChapterSelect = (chapterIndex: number) => {
    setCurrentWordIndex(chapters[chapterIndex].startIndex);
    setCurrentChapter(chapterIndex);
    setIsPlaying(false);
  };

  // Handle file upload
  const handleFileProcessed = (
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
    setCurrentFileName(data.fileName);
    setCurrentWordIndex(0);
    setIsPlaying(false);

    if (data.chapters && data.chapters.length > 0) {
      setChapters(data.chapters);
      setCurrentChapter(0);
    } else {
      setChapters([]);
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

  return (
    <div className="embedded-reader-container">
      <div className="embedded-reader">
        {words.length > 0 ? (
          <div className="reader-content">
            <WordReader
              words={words}
              currentWordIndex={currentWordIndex}
              isPlaying={isPlaying}
              wpm={wpm}
              onWordIndexChange={setCurrentWordIndex}
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
              fileName={currentFileName}
              onThemeToggle={toggleDarkMode}
            />
          </div>
        ) : (
          <div className="no-content-message">
            <p>Enter text above or upload a text file to start reading</p>
          </div>
        )}
      </div>

      <div className="file-upload-section text-only">
        <h3>Upload a Text File</h3>
        <FileInput
          inputType={InputType.TEXT}
          onFileProcessed={handleFileProcessed}
          acceptFormats=".txt,.text,.md"
        />
      </div>
    </div>
  );
};

export default TextReader;
