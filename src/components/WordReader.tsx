import React, { useEffect, useState, useCallback, useRef } from "react";
import "../SpeedReader.css";

export interface WordReaderProps {
  words: string[];
  currentWordIndex: number;
  isPlaying: boolean;
  wpm: number;
  onWordIndexChange: (index: number) => void;
  isDarkMode: boolean;
}

interface DisplayWords {
  prev: string;
  current: string;
  next: string;
}

const WordReader: React.FC<WordReaderProps> = ({
  words,
  currentWordIndex,
  isPlaying,
  wpm,
  onWordIndexChange,
  isDarkMode,
}) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 640);

  // Function to safely get display words, handling array bounds
  const getDisplayWords = (index: number): DisplayWords => {
    if (!words || words.length === 0) {
      return { prev: "", current: "No content to display", next: "" };
    }

    // Ensure the index is within bounds
    const safeIndex = Math.min(Math.max(0, index), words.length - 1);
    const prevWord = safeIndex > 0 ? words[safeIndex - 1] : "";
    const nextWord = safeIndex < words.length - 1 ? words[safeIndex + 1] : "";

    return {
      prev: prevWord,
      current: words[safeIndex] || "End",
      next: nextWord,
    };
  };

  // Handle responsive design
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 640);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Setup playing/pausing based on isPlaying state
  useEffect(() => {
    if (isPlaying && words.length > 0) {
      // Clear any existing interval
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      // Calculate interval based on wpm
      const intervalMs = 60000 / wpm;

      // Set up the interval
      intervalRef.current = setInterval(() => {
        onWordIndexChange(currentWordIndex + 1);
      }, intervalMs);

      // Check if we've reached the end
      if (currentWordIndex >= words.length - 1) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    } else {
      // Clear interval when paused
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Cleanup on unmount or dependency changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isPlaying, wpm, currentWordIndex, words.length, onWordIndexChange]);

  return (
    <div className="text-display">
      <div className="word-display">
        <span className="word">{getDisplayWords(currentWordIndex).prev}</span>
        <span className={`word ${!isMobile ? "current-word" : ""}`}>
          {getDisplayWords(currentWordIndex).current}
        </span>
        <span className={`word ${isMobile ? "current-word" : ""}`}>
          {getDisplayWords(currentWordIndex).next}
        </span>
      </div>
    </div>
  );
};

export default WordReader;
