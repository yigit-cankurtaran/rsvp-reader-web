import { Book } from "../types/reader";

const LIBRARY_STORAGE_KEY = "speedReaderLibrary";

export const getLibrary = (): Book[] => {
  const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
  return libraryData ? JSON.parse(libraryData) : [];
};

export const saveLibrary = (books: Book[]): void => {
  localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
};

export const addBook = (book: Book): void => {
  const library = getLibrary();
  // Check if book with same filename already exists
  const existingBookIndex = library.findIndex(b => b.fileName === book.fileName);
  
  if (existingBookIndex >= 0) {
    // Update existing book
    library[existingBookIndex] = {
      ...book,
      id: library[existingBookIndex].id // Preserve the original ID
    };
  } else {
    // Add new book
    library.push(book);
  }
  
  saveLibrary(library);
};

export const updateBookProgress = (bookId: string, currentWordIndex: number): void => {
  const library = getLibrary();
  const bookIndex = library.findIndex(book => book.id === bookId);
  
  if (bookIndex >= 0) {
    library[bookIndex] = {
      ...library[bookIndex],
      currentWordIndex,
      lastReadDate: new Date().toISOString()
    };
    
    saveLibrary(library);
  }
};

export const removeBook = (bookId: string): void => {
  const library = getLibrary();
  const updatedLibrary = library.filter(book => book.id !== bookId);
  saveLibrary(updatedLibrary);
};

export const getBookById = (bookId: string): Book | undefined => {
  const library = getLibrary();
  return library.find(book => book.id === bookId);
};

export const getBookByFileName = (fileName: string): Book | undefined => {
  const library = getLibrary();
  return library.find(book => book.fileName === fileName);
};

export const generateFallbackCover = (title: string, author: string): string => {
  // Generate a deterministic color based on the title
  const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const hue = hash % 360;
  const saturation = 60 + (hash % 20);
  const lightness = 65 + (hash % 15);
  
  // Create a data URL for a colored rectangle with text
  const canvas = document.createElement('canvas');
  canvas.width = 200;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  
  if (ctx) {
    // Background
    ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Title text
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.font = 'bold 16px Arial, sans-serif';
    ctx.textAlign = 'center';
    
    // Wrap title text
    const words = title.split(' ');
    let line = '';
    let lines = [];
    const maxWidth = canvas.width - 20;
    
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      const metrics = ctx.measureText(testLine);
      
      if (metrics.width > maxWidth && i > 0) {
        lines.push(line);
        line = words[i] + ' ';
      } else {
        line = testLine;
      }
    }
    lines.push(line);
    
    // Draw title (max 3 lines)
    const displayLines = lines.slice(0, 3);
    if (lines.length > 3) {
      displayLines[2] = displayLines[2].trim() + '...';
    }
    
    displayLines.forEach((line, index) => {
      ctx.fillText(line, canvas.width / 2, canvas.height / 2 - 10 + (index * 20));
    });
    
    // Author text
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(author, canvas.width / 2, canvas.height / 2 + 50);
  }
  
  return canvas.toDataURL('image/png');
}; 