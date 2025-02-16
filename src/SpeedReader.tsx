import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";

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

      // Extract text from all content files
      for (const file of contentFiles) {
        const content = await file.async("text");
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");

        // Remove style and script tags
        doc.querySelectorAll("style, script").forEach((el) => el.remove());

        // Look for chapter titles (adjust selectors based on your EPUB structure)
        const chapterTitle =
          doc.querySelector("h1, h2")?.textContent ||
          `Chapter ${extractedChapters.length + 1}`;

        // Get text content
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

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-6">
        <div className="h-32 flex items-center justify-center bg-gray-50 rounded-lg mb-6">
          <span
            className="text-4xl font-bold"
            style={{ wordBreak: "break-word" }}
          >
            {words[currentWordIndex] || "Ready"}
          </span>
        </div>

        <div className="space-y-4">
          <div className="flex justify-center space-x-4">
            <button
              onClick={togglePlay}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
            >
              Reset
            </button>
          </div>

          <div className="flex items-center justify-center space-x-4">
            <label className="text-sm font-medium">WPM:</label>
            <input
              type="range"
              min="100"
              max="1000"
              step="50"
              value={wpm}
              onChange={handleWpmChange}
              className="w-48"
            />
            <span className="text-sm font-medium">{wpm}</span>
          </div>

          {chapters.length > 0 && (
            <div className="flex items-center justify-center space-x-4">
              <label className="text-sm font-medium">Chapter:</label>
              <select
                value={currentChapter}
                onChange={(e) => handleChapterSelect(Number(e.target.value))}
                className="p-1 border rounded"
              >
                {chapters.map((chapter, index) => (
                  <option key={index} value={index}>
                    {chapter.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-center">
            <input
              type="file"
              accept=".txt,.epub"
              onChange={handleFileUpload}
              className="text-sm"
            />
          </div>

          <div className="text-center text-sm text-gray-600">
            {words.length > 0 &&
              `${currentWordIndex + 1} / ${words.length} words`}
          </div>

          {fileName && (
            <div className="text-center text-sm text-gray-600 mt-2">
              Current file: {fileName}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpeedReader;
