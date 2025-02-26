import { Book } from "../types/reader";
import { 
  db, 
  getAllBooks, 
  getBookById as getBookByIdFromDB, 
  addOrUpdateBook,
  removeBookFromDB,
  updateBookProgressInDB,
  migrateFromLocalStorage
} from "./dexieDB";

const LIBRARY_STORAGE_KEY = "speedReaderLibrary";

// Get all books from the library
export const getLibrary = async (): Promise<Book[]> => {
  try {
    // Try to migrate from localStorage to IndexedDB the first time
    await migrateFromLocalStorage();

    // Get books from IndexedDB
    const books = await getAllBooks();
    
    if (books.length > 0) {
      return books;
    }
    
    // Fall back to localStorage if IndexedDB is empty
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    const localBooks = libraryData ? JSON.parse(libraryData) : [];
    
    // If we found books in localStorage but not in IndexedDB,
    // migrate them to IndexedDB for next time
    if (localBooks.length > 0) {
      console.log(`Found ${localBooks.length} books in localStorage, migrating to IndexedDB`);
      
      // Save each book to IndexedDB
      for (const book of localBooks) {
        await addOrUpdateBook(book);
      }
      
      // Try to get books from IndexedDB again
      return await getAllBooks();
    }
    
    return [];
  } catch (error) {
    console.error("Error getting library:", error);
    
    // Last resort: try to get books from localStorage
    try {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      return libraryData ? JSON.parse(libraryData) : [];
    } catch (e) {
      console.error("Failed to get books from localStorage:", e);
      return [];
    }
  }
};

// Get a book by ID
export const getBookById = async (id: string): Promise<Book | undefined> => {
  try {
    // Try to get from IndexedDB first
    const book = await getBookByIdFromDB(id);
    if (book) {
      return book;
    }
    
    // Fall back to localStorage
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (libraryData) {
      const books = JSON.parse(libraryData) as Book[];
      return books.find(book => book.id === id);
    }
    
    return undefined;
  } catch (error) {
    console.error(`Error getting book with ID ${id}:`, error);
    
    // Last resort: try localStorage
    try {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (libraryData) {
        const books = JSON.parse(libraryData) as Book[];
        return books.find(book => book.id === id);
      }
    } catch (e) {
      console.error("Failed to get book from localStorage:", e);
    }
    
    return undefined;
  }
};

// Add a book to the library
export const addBook = async (book: Book): Promise<string> => {
  try {
    // Add to IndexedDB
    const bookId = await addOrUpdateBook(book);
    
    // Also update localStorage for backward compatibility
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    let books: Book[] = libraryData ? JSON.parse(libraryData) : [];
    
    // Check if book already exists by ID
    const existingIndex = books.findIndex((b) => b.id === book.id);
    
    if (existingIndex !== -1) {
      // Update existing book
      books[existingIndex] = book;
    } else {
      // Add new book
      books.push(book);
    }
    
    // Save updated library to localStorage
    localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
    
    return bookId;
  } catch (error) {
    console.error("Error adding book:", error);
    
    // Fall back to localStorage only
    try {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      let books: Book[] = libraryData ? JSON.parse(libraryData) : [];
      
      // Check if book already exists by filename
      const existingIndex = books.findIndex((b) => b.fileName === book.fileName);
      
      if (existingIndex !== -1) {
        // Update existing book but preserve the ID
        const existingId = books[existingIndex].id;
        books[existingIndex] = { ...book, id: existingId };
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
        return existingId;
      } else {
        // Add new book
        books.push(book);
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
        return book.id;
      }
    } catch (e) {
      console.error("Failed to add book to localStorage:", e);
      throw new Error("Failed to add book to library");
    }
  }
};

// Remove a book from the library
export const removeBook = async (id: string): Promise<void> => {
  try {
    // Remove from IndexedDB
    await removeBookFromDB(id);
    
    // Also remove from localStorage for backward compatibility
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (libraryData) {
      let books: Book[] = JSON.parse(libraryData);
      books = books.filter((book) => book.id !== id);
      localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
    }
  } catch (error) {
    console.error(`Error removing book with ID ${id}:`, error);
    
    // Try to remove just from localStorage
    try {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (libraryData) {
        let books: Book[] = JSON.parse(libraryData);
        books = books.filter((book) => book.id !== id);
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
      }
    } catch (e) {
      console.error("Failed to remove book from localStorage:", e);
      throw new Error("Failed to remove book from library");
    }
  }
};

// Update a book's reading progress
export const updateBookProgress = async (id: string, currentWordIndex: number): Promise<void> => {
  try {
    // Update in IndexedDB
    await updateBookProgressInDB(id, currentWordIndex);
    
    // Also update in localStorage for backward compatibility
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (libraryData) {
      let books: Book[] = JSON.parse(libraryData);
      const bookIndex = books.findIndex((book) => book.id === id);
      
      if (bookIndex !== -1) {
        books[bookIndex].currentWordIndex = currentWordIndex;
        books[bookIndex].lastReadDate = new Date().toISOString();
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
      }
    }
  } catch (error) {
    console.error(`Error updating progress for book with ID ${id}:`, error);
    
    // Try to update just in localStorage
    try {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (libraryData) {
        let books: Book[] = JSON.parse(libraryData);
        const bookIndex = books.findIndex((book) => book.id === id);
        
        if (bookIndex !== -1) {
          books[bookIndex].currentWordIndex = currentWordIndex;
          books[bookIndex].lastReadDate = new Date().toISOString();
          localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
        }
      }
    } catch (e) {
      console.error("Failed to update book progress in localStorage:", e);
    }
  }
};

// Generate a fallback cover image using a data URL
export const generateFallbackCover = (title: string, author: string): string => {
  // Get first characters from title and author
  const titleChar = title.charAt(0).toUpperCase();
  const authorChar = author.charAt(0).toUpperCase();
  
  // Generate a deterministic pastel color based on the title
  const hue = Math.abs(
    title.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
  );
  const bgColor = `hsl(${hue}, 70%, 80%)`;
  const textColor = `hsl(${hue}, 70%, 30%)`;
  
  // Create a canvas to draw the cover
  const canvas = document.createElement("canvas");
  canvas.width = 300;
  canvas.height = 450;
  const ctx = canvas.getContext("2d");
  
  if (!ctx) {
    return ""; // Fallback if canvas isn't supported
  }
  
  // Draw background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Draw title character
  ctx.fillStyle = textColor;
  ctx.font = "bold 120px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(titleChar, canvas.width / 2, canvas.height / 2 - 40);
  
  // Draw author character
  ctx.font = "bold 80px Arial";
  ctx.fillText(authorChar, canvas.width / 2, canvas.height / 2 + 60);
  
  // Draw title text
  ctx.font = "20px Arial";
  ctx.fillText(title.slice(0, 20), canvas.width / 2, canvas.height - 80);
  if (title.length > 20) {
    ctx.fillText(title.slice(20, 40), canvas.width / 2, canvas.height - 55);
  }
  
  // Draw author text
  ctx.font = "16px Arial";
  ctx.fillText(author.slice(0, 25), canvas.width / 2, canvas.height - 30);
  
  // Return data URL
  return canvas.toDataURL("image/jpeg");
}; 