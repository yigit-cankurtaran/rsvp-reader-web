import React from "react";
import { Chapter } from "../types/reader";

interface ReaderControlsProps {
  isPlaying: boolean;
  wpm: number;
  currentChapter: number;
  chapters: Chapter[];
  currentWordIndex: number;
  totalWords: number;
  fileName: string;
  isDarkMode: boolean;
  onPlayPause: () => void;
  onReset: () => void;
  onWpmChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChapterSelect: (chapterIndex: number) => void;
  onThemeToggle: () => void;
}

const ReaderControls: React.FC<ReaderControlsProps> = ({
  isPlaying,
  wpm,
  currentChapter,
  chapters,
  currentWordIndex,
  totalWords,
  fileName,
  isDarkMode,
  onPlayPause,
  onReset,
  onWpmChange,
  onChapterSelect,
  onThemeToggle,
}) => {
  return (
    <div className="controls">
      <div className="control-buttons">
        <button onClick={onPlayPause} className="btn btn-primary">
          {isPlaying ? "Pause" : "Play"}
        </button>
        <button onClick={onReset} className="btn btn-secondary">
          Reset
        </button>
      </div>

      <div className="wpm-control">
        <label>WPM:</label>
        <div className="wpm-inputs">
          <input
            type="range"
            min="100"
            max="1000"
            step="50"
            value={wpm}
            onChange={onWpmChange}
            className="wpm-slider"
          />
          <input
            type="number"
            min="100"
            max="1000"
            value={wpm}
            onChange={onWpmChange}
            className="wpm-number"
          />
        </div>
      </div>

      {chapters.length > 0 && (
        <div className="chapter-control">
          <label htmlFor="chapter-select">Chapter:</label>
          <select
            id="chapter-select"
            value={currentChapter}
            onChange={(e) => onChapterSelect(Number(e.target.value))}
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

      {totalWords > 0 && (
        <div className="progress-text">
          {currentWordIndex + 1} / {totalWords} words
        </div>
      )}

      {fileName && <div className="filename-display">Reading: {fileName}</div>}

      <button
        className="theme-toggle"
        onClick={onThemeToggle}
        aria-label="Toggle theme"
      >
        {isDarkMode ? "☀️" : "🌙"}
      </button>
    </div>
  );
};

export default ReaderControls;
