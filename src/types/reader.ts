export interface Chapter {
  title: string;
  startIndex: number;
  endIndex: number;
}

export interface Book {
  id: string;
  fileName: string;
  title: string;
  author: string;
  coverUrl: string | null;
  totalWords: number;
  currentWordIndex: number;
  lastReadDate: string;
  chapters: Chapter[];
}

export interface ReaderState {
  text: string;
  words: string[];
  currentWordIndex: number;
  isPlaying: boolean;
  wpm: number;
  fileName: string;
  chapters: Chapter[];
  currentChapter: number;
  isDarkMode: boolean;
}

export enum InputType {
  TEXT = "text",
  EPUB = "epub",
}

export interface FileInputProps {
  inputType: InputType;
  onFileProcessed: (data: {
    text: string;
    words: string[];
    fileName: string;
    chapters?: Chapter[];
  }, file?: File) => void;
  acceptFormats?: string; // Optional, to specify acceptable file formats
}

export interface ReaderControlsProps {
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

export interface WordReaderProps {
  words: string[];
  currentWordIndex: number;
  isPlaying: boolean;
  wpm: number;
  onWordIndexChange: (index: number) => void;
  isDarkMode: boolean;
}

export interface TextReaderProps {
  initialText?: string;
  initialWords?: string[];
  fileName?: string;
  onNavigateToLibrary?: () => void;
}

