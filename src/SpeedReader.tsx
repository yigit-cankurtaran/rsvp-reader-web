import React, { useState, useEffect, useCallback } from "react";
import JSZip from "jszip";

const SpeedReader = () => {
  const [text, setText] = useState(
    "Welcome to Speed Reader! Upload your text to begin."
  );
  const [words, setWords] = useState<string[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);

  const msPerWord = Math.floor(60000 / wpm);

  // Extract text content from EPUB
  const extractEpubContent = async (file: File) => {
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(file);

      // Find and read the OPF file first
      const opfFile = Object.values(contents.files).find((file) =>
        file.name.endsWith(".opf")
      );

      if (!opfFile) {
        throw new Error("Could not find OPF file in EPUB");
      }

      // Find all HTML/XHTML content files
      const contentFiles = Object.values(contents.files).filter(
        (file) => file.name.endsWith(".html") || file.name.endsWith(".xhtml")
      );

      // Extract text from all content files
      const textPromises = contentFiles.map(async (file) => {
        const content = await file.async("text");
        // Strip HTML tags and decode entities
        return content
          .replace(/<[^>]*>/g, " ")
          .replace(/&([^;]+);/g, (_, entity) => {
            const entities = {
              amp: "&",
              lt: "<",
              gt: ">",
              quot: '"',
              apos: "'",
              nbsp: " ",
            };
            return entities[entity as keyof typeof entities] || " ";
          })
          .trim();
      });

      const textContents = await Promise.all(textPromises);
      return textContents.join(" ");
    } catch (error) {
      console.error("Error parsing EPUB:", error);
      throw new Error("Failed to parse EPUB file");
    }
  };

  // Process text into words
  const processText = useCallback((text: string) => {
    return text
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
      .replace(/\s+/g, " ") // Normalize whitespace
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);
  }, []);

  // Handle file upload
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
      setCurrentWordIndex(0);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error reading file:", error);
      alert(
        "Error reading file. Please make sure it is a valid EPUB or text file."
      );
    }
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
              onClick={() => setIsPlaying(!isPlaying)}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              {isPlaying ? "Pause" : "Play"}
            </button>
            <button
              onClick={() => setCurrentWordIndex(0)}
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
              onChange={(e) => setWpm(Number(e.target.value))}
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
        </div>
      </div>
    </div>
  );
};

export default SpeedReader;
