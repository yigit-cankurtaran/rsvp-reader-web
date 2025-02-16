export interface Chapter {
  title: string;
  startIndex: number;
  endIndex: number;
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
  TEXT = 'text',
  EPUB = 'epub'
} 