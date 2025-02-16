import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";
import "./SpeedReader.css";
// keep an eye on the chapter order
// far off TODO: add a local TTS thingy with kokoro

interface Chapter {
  title: string;
  startIndex: number;
  endIndex: number;
}

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

  const msPerWord = Math.floor(60000 / wpm);

  // Extract text content from EPUB
  const extractEpubContent = async (file: File) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Find and sort content files
      const contentFiles = Object.values(contents.files)
        .filter(
          (file) => file.name.endsWith(".html") || file.name.endsWith(".xhtml")
        )
        .sort((a, b) => {
          // Sort by filename/path
          const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
          const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
          if (aNum === bNum) {
            return a.name.localeCompare(b.name);
          }
          return aNum - bNum;
        });

      let allWords: string[] = [];
      let extractedChapters: Chapter[] = [];
      let currentIndex = 0;
      let seenTitles = new Set<string>();

      // Extract text from all content files
      for (const file of contentFiles) {
        const content = await file.async("text");
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");

        // Remove style and script tags
        doc.querySelectorAll("style, script").forEach((el) => el.remove());

        // Look for chapter titles (adjust selectors based on your EPUB structure)
        let chapterTitle =
          doc.querySelector("h1, h2, title")?.textContent?.trim() ||
          `Chapter ${extractedChapters.length + 1}`;

        // Add chapter number if title is duplicate
        if (seenTitles.has(chapterTitle)) {
          chapterTitle = `${chapterTitle} (${extractedChapters.length + 1})`;
        }
        seenTitles.add(chapterTitle);

        const text = doc.body.textContent || "";
        const words = processText(text);

        if (words.length > 0) {
          extractedChapters.push({
            title: chapterTitle,
            startIndex: currentIndex,
            endIndex: currentIndex + words.length - 1,
          });

          allWords = [...allWords, ...words];
          currentIndex += words.length;
        }
      }

      setChapters(extractedChapters);
      localStorage.setItem(
        "speedReaderChapters",
        JSON.stringify(extractedChapters)
      );

      return allWords.join(" ");
    } catch (error) {
      console.error("Error parsing EPUB:", error);
      throw new Error("Failed to parse EPUB file");
    }
  };

  // Simplified processText since HTML/CSS is already stripped
  const processText = useCallback((text: string) => {
    return text
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }, []);

  // Save progress when pausing
  const togglePlay = () => {
    const newPlayState = !isPlaying;
    setIsPlaying(newPlayState);
    if (!newPlayState) {
      localStorage.setItem("speedReaderProgress", currentWordIndex.toString());
      localStorage.setItem("speedReaderWords", JSON.stringify(words));
    }
  };

  // Save progress when uploading new file
  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      let content;
      if (file.name.toLowerCase().endsWith(".epub")) {
        content = await extractEpubContent(file);
      } else {
        // Handle regular text files
        content = await file.text();
      }

      setText(content);
      const processedWords = processText(content);
      setWords(processedWords);
      setFileName(file.name);
      localStorage.setItem("speedReaderWords", JSON.stringify(processedWords));
      localStorage.setItem("speedReaderProgress", "0");
      localStorage.setItem("speedReaderFileName", file.name);
      setCurrentWordIndex(0);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error reading file:", error);
      alert(
        "Error reading file. Please make sure it is a valid EPUB or text file."
      );
    }
  };

  // Update WPM handler to save setting
  const handleWpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newWpm = Number(e.target.value);
    setWpm(newWpm);
    localStorage.setItem("speedReaderWpm", newWpm.toString());
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

  return (
    <div className="reader-container">
      <div className="controls">
        <div className="word-display">
          <span className="current-word">
            {words[currentWordIndex] || "Ready"}
          </span>
        </div>

        <div className="control-buttons">
          <button onClick={togglePlay} className="btn btn-primary">
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button onClick={handleReset} className="btn btn-secondary">
            Reset
          </button>
        </div>

        <div className="wpm-control">
          <label>WPM:</label>
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={wpm}
            onChange={handleWpmChange}
            className="wpm-slider"
          />
          <span>{wpm}</span>
        </div>

        {chapters.length > 0 && (
          <div className="chapter-control">
            <label>Chapter:</label>
            <select
              value={currentChapter}
              onChange={(e) => handleChapterSelect(Number(e.target.value))}
              className="chapter-select"
            >
              {chapters.map((chapter, index) => (
                <option key={index} value={index}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="file-control">
          <input
            type="file"
            accept=".txt,.epub"
            onChange={handleFileUpload}
            className="file-input"
          />
        </div>

        {words.length > 0 && (
          <div className="progress-text">
            {currentWordIndex + 1} / {words.length} words
          </div>
        )}

        {fileName && (
          <div className="filename-display">Current file: {fileName}</div>
        )}

        <button
          className="theme-toggle"
          onClick={() => setIsDarkMode(!isDarkMode)}
          aria-label="Toggle theme"
        >
          {isDarkMode ? "☀️" : "🌙"}
        </button>
      </div>
    </div>
  );
};

export default SpeedReader;
