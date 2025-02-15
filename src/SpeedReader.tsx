import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";

// TODO: change speed according to the word length
// e.g. longer words stay on screen longer, shorter words stay on screen for a shorter duration
// TODO: add chapters so people can skip introductions and whatnot
// TODO: save progress upon exit or save button press
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

  const msPerWord = Math.floor(60000 / wpm);

  // Extract text content from EPUB
  const extractEpubContent = async (file: File) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Find all HTML/XHTML content files
      const contentFiles = Object.values(contents.files).filter(
        (file) => file.name.endsWith(".html") || file.name.endsWith(".xhtml")
      );

      // Extract text from all content files
      const textPromises = contentFiles.map(async (file) => {
        const content = await file.async("text");
        // Create a DOM parser
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, "text/html");

        // Remove style and script tags
        doc.querySelectorAll("style, script").forEach((el) => el.remove());

        // Get only the text content
        return doc.body.textContent || "";
      });

      const textContents = await Promise.all(textPromises);
      return textContents.join(" ").trim();
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

  // Update handleReset to clear filename
  const handleReset = () => {
    setCurrentWordIndex(0);
    setFileName("");
    setWords([]);
    localStorage.removeItem("speedReaderProgress");
    localStorage.removeItem("speedReaderWords");
    localStorage.removeItem("speedReaderFileName");
    setIsPlaying(false);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPlaying && currentWordIndex < words.length) {
      interval = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= words.length - 1) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, msPerWord);
    }
    return () => clearInterval(interval);
  }, [isPlaying, currentWordIndex, words.length, msPerWord]);

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
