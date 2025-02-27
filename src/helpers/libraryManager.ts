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
    // Try to migrate from localStorage to IndexedDB if needed
    try {
      await migrateFromLocalStorage();
    } catch (e) {
      console.warn("Migration from localStorage failed, but will continue:", e);
    }

    // Get books from IndexedDB as primary source
    const books = await getAllBooks();
    
    if (books.length > 0) {
      return books;
    }
    
    // Fall back to localStorage only if IndexedDB is empty
    if (typeof localStorage !== 'undefined') {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      
      if (!libraryData) {
        return []; // No data in localStorage either
      }
      
      try {
        const localBooks = JSON.parse(libraryData);
        
        // Check if we have actual book objects or just minimal references
        if (localBooks.length > 0 && 
            typeof localBooks[0] === 'object' && 
            'author' in localBooks[0] && 
            'totalWords' in localBooks[0]) {
          
          console.log(`Found ${localBooks.length} full book objects in localStorage, migrating to IndexedDB`);
          
          // We have full books objects, migrate them to IndexedDB
          for (const book of localBooks) {
            await addOrUpdateBook(book);
          }
          
          // Clear the full objects from localStorage and replace with minimal references
          const minimalRefs = localBooks.map((book: Book) => ({
            id: book.id,
            title: book.title,
            lastUpdated: new Date().toISOString()
          }));
          localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(minimalRefs));
          
          // Return books from IndexedDB
          return await getAllBooks();
        } else {
          // We only have minimal references, so try to get full books from IndexedDB
          const fullBooks: Book[] = [];
          
          for (const ref of localBooks) {
            if (ref.id) {
              const book = await getBookByIdFromDB(ref.id);
              if (book) {
                fullBooks.push(book);
              }
            }
          }
          
          if (fullBooks.length > 0) {
            return fullBooks;
          }
          
          // If we couldn't get any books, the references are stale
          if (localBooks.length > 0 && fullBooks.length === 0) {
            console.warn("Found stale references in localStorage, clearing them");
            localStorage.removeItem(LIBRARY_STORAGE_KEY);
          }
          
          return [];
        }
      } catch (e) {
        console.error("Failed to parse books from localStorage:", e);
        // Clear invalid data
        localStorage.removeItem(LIBRARY_STORAGE_KEY);
        return [];
      }
    }
    
    return [];
  } catch (error) {
    console.error("Error getting library:", error);
    
    // Last resort: try to get books from localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (!libraryData) return [];
        
        const localBooks = JSON.parse(libraryData);
        
        // Check if we have actual book objects
        if (localBooks.length > 0 && 
            typeof localBooks[0] === 'object' && 
            'author' in localBooks[0] && 
            'totalWords' in localBooks[0]) {
          return localBooks;
        }
        
        return [];
      } catch (e) {
        console.error("Failed to get books from localStorage:", e);
        return [];
      }
    }
    
    return [];
  }
};

// Get a book by ID
export const getBookById = async (id: string): Promise<Book | undefined> => {
  if (!id) {
    console.error("Invalid book ID provided");
    return undefined;
  }
  
  try {
    // Try to get from IndexedDB first (primary source)
    const book = await getBookByIdFromDB(id);
    if (book) {
      return book;
    }
    
    // Fall back to localStorage only if not found in IndexedDB
    if (typeof localStorage !== 'undefined') {
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (!libraryData) {
        return undefined;
      }
      
      try {
        const books = JSON.parse(libraryData);
        
        // Check if we have actual book objects or just minimal references
        if (books.length > 0 && 
            typeof books[0] === 'object' && 
            'author' in books[0] && 
            'totalWords' in books[0]) {
          
          // We have full book objects
          const localBook = books.find((book: Book) => book.id === id);
          
          if (localBook) {
            // Found in localStorage, migrate to IndexedDB for next time
            await addOrUpdateBook(localBook);
            
            // Return the found book
            return localBook;
          }
        }
        
        // No book found with this ID
        return undefined;
      } catch (e) {
        console.error("Failed to parse books from localStorage:", e);
        return undefined;
      }
    }
    
    return undefined;
  } catch (error) {
    console.error(`Error getting book with ID ${id}:`, error);
    
    // Last resort: try localStorage
    if (typeof localStorage !== 'undefined') {
      try {
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (!libraryData) {
          return undefined;
        }
        
        const books = JSON.parse(libraryData);
        
        // Check if we have actual book objects
        if (books.length > 0 && 
            typeof books[0] === 'object' && 
            'author' in books[0]) {
          
          return books.find((book: any) => book.id === id);
        }
      } catch (e) {
        console.error("Failed to get book from localStorage:", e);
      }
    }
    
    return undefined;
  }
};

// Add a book to the library
export const addBook = async (book: Book): Promise<string> => {
  try {
    // Add to IndexedDB as the primary storage
    const bookId = await addOrUpdateBook(book);
    
    // Only store minimal data in localStorage for compatibility
    // Instead of full book data, just store a reference
    if (typeof localStorage !== 'undefined') {
      try {
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        let books: { id: string, title: string, lastUpdated: string }[] = [];
        
        if (libraryData) {
          // Try to parse existing data
          try {
            const existingBooks = JSON.parse(libraryData);
            // If existing data is full book objects, convert to minimal format
            books = existingBooks.map((b: any) => ({
              id: b.id,
              title: b.title || 'Unknown Book',
              lastUpdated: new Date().toISOString()
            }));
          } catch (e) {
            // If parsing fails, start with an empty array
            console.error('Error parsing library data, starting fresh:', e);
            books = [];
          }
        }
        
        // Update or add minimal book reference
        const existingIndex = books.findIndex((b) => b.id === book.id);
        const minimalBook = {
          id: book.id,
          title: book.title,
          lastUpdated: new Date().toISOString()
        };
        
        if (existingIndex !== -1) {
          books[existingIndex] = minimalBook;
        } else {
          books.push(minimalBook);
        }
        
        // Save lightweight references to localStorage
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
      } catch (e) {
        // If localStorage fails, it's ok since IndexedDB is our primary storage
        console.warn('Could not update localStorage, but book was saved to IndexedDB:', e);
      }
    }
    
    return bookId;
  } catch (error) {
    console.error("Error adding book:", error);
    
    // Fall back to localStorage only if IndexedDB completely fails
    if (typeof localStorage !== 'undefined') {
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
      }
    }
    
    throw new Error("Failed to add book to library");
  }
};

// Remove a book from the library
export const removeBook = async (id: string): Promise<void> => {
  try {
    // Remove from IndexedDB - removeBookFromDB already handles book, word chunks, and progress
    await removeBookFromDB(id);
    
    // Clean localStorage completely
    if (typeof localStorage !== 'undefined') {
      // Remove from library list
      const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
      if (libraryData) {
        let books: Book[] = JSON.parse(libraryData);
        books = books.filter((book) => book.id !== id);
        localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
      }
      
      // Remove any word chunks related to this book
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.startsWith(`speedReaderWords_${id}`) || 
          key.includes(`${id}_chunk_`)
        )) {
          localStorage.removeItem(key);
          // Adjust index since we're removing items while iterating
          i--;
        }
      }
      
      // If this was the current book, clear that reference
      if (localStorage.getItem("speedReaderCurrentBookId") === id) {
        localStorage.removeItem("speedReaderCurrentBookId");
      }
    }
    
    console.log(`Successfully removed book ${id} from all storage`);
  } catch (error) {
    console.error(`Error removing book with ID ${id}:`, error);
    
    // Try to remove just from localStorage as a fallback
    try {
      if (typeof localStorage !== 'undefined') {
        // Remove from library list
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (libraryData) {
          let books: Book[] = JSON.parse(libraryData);
          books = books.filter((book) => book.id !== id);
          localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
        }
        
        // Remove any word chunks related to this book
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (
            key.startsWith(`speedReaderWords_${id}`) || 
            key.includes(`${id}_chunk_`)
          )) {
            localStorage.removeItem(key);
            // Adjust index since we're removing items while iterating
            i--;
          }
        }
        
        // If this was the current book, clear that reference
        if (localStorage.getItem("speedReaderCurrentBookId") === id) {
          localStorage.removeItem("speedReaderCurrentBookId");
        }
      }
    } catch (e) {
      console.error("Failed to remove book from localStorage:", e);
      throw new Error("Failed to remove book from library");
    }
  }
};

// Update a book's reading progress
export const updateBookProgress = async (id: string, currentWordIndex: number): Promise<void> => {
  if (!id) {
    console.error("Invalid book ID provided");
    return;
  }
  
  try {
    // Update in IndexedDB as the primary storage
    await updateBookProgressInDB(id, currentWordIndex);
    
    // Only store a timestamp in localStorage to indicate the book was updated,
    // but not the full progress data
    if (typeof localStorage !== 'undefined') {
      try {
        // Update the minimal reference if it exists
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (libraryData) {
          try {
            const books = JSON.parse(libraryData);
            const bookIndex = books.findIndex((b: any) => b.id === id);
            
            if (bookIndex !== -1) {
              // Only update lastUpdated timestamp, not the progress itself
              books[bookIndex].lastUpdated = new Date().toISOString();
              localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
            }
          } catch (e) {
            // Invalid JSON, ignore the error
            console.warn("Invalid JSON in localStorage, skipping update:", e);
          }
        }
        
        // Keep the current book ID in localStorage (small data)
        localStorage.setItem("speedReaderCurrentBookId", id);
      } catch (e) {
        // If localStorage fails, it's ok since IndexedDB is our primary storage
        console.warn('Failed to update localStorage progress, but updated in IndexedDB:', e);
      }
    }
  } catch (error) {
    console.error(`Error updating progress for book with ID ${id}:`, error);
    
    // Fall back to localStorage only if IndexedDB fails
    if (typeof localStorage !== 'undefined') {
      try {
        const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
        if (libraryData) {
          try {
            let books = JSON.parse(libraryData);
            const bookIndex = books.findIndex((b: any) => b.id === id);
            
            if (bookIndex !== -1 && 'currentWordIndex' in books[bookIndex]) {
              // Only update if it's a full book object
              books[bookIndex].currentWordIndex = currentWordIndex;
              books[bookIndex].lastReadDate = new Date().toISOString();
              localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(books));
            }
          } catch (e) {
            console.error("Failed to parse localStorage data:", e);
          }
        }
      } catch (e) {
        console.error("Failed to update book progress in localStorage:", e);
      }
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

// Clean up localStorage by removing stale data and minimizing book storage
export const cleanupLocalStorage = async (): Promise<void> => {
  if (typeof localStorage === 'undefined') {
    return;
  }
  
  try {
    console.log("Cleaning up localStorage...");
    
    // 1. Get all valid books from IndexedDB
    const indexedDBBooks = await getAllBooks();
    const validBookIds = new Set(indexedDBBooks.map(book => book.id));
    
    // 2. Clean up the library list in localStorage
    const libraryData = localStorage.getItem(LIBRARY_STORAGE_KEY);
    if (libraryData) {
      try {
        const localBooks = JSON.parse(libraryData);
        
        // If we have full book objects, convert to minimal references
        if (localBooks.length > 0 && 
            typeof localBooks[0] === 'object' && 
            'author' in localBooks[0] && 
            'totalWords' in localBooks[0]) {
          
          console.log("Converting full book objects to minimal references");
          
          // Filter to keep only valid books and convert to minimal format
          const minimalRefs = localBooks
            .filter((book: Book) => validBookIds.has(book.id))
            .map((book: Book) => ({
              id: book.id,
              title: book.title,
              lastUpdated: new Date().toISOString()
            }));
          
          localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(minimalRefs));
        } else {
          // Clean up existing minimal references
          const validRefs = localBooks.filter((ref: any) => 
            ref.id && validBookIds.has(ref.id)
          );
          
          if (validRefs.length !== localBooks.length) {
            console.log(`Removed ${localBooks.length - validRefs.length} stale book references`);
            localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(validRefs));
          }
        }
      } catch (e) {
        console.error("Invalid JSON in localStorage library data, clearing it:", e);
        localStorage.removeItem(LIBRARY_STORAGE_KEY);
      }
    }
    
    // 3. Clean up any orphaned word chunks
    let removedItems = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      
      // Check for word chunks or book-specific data
      if (key.startsWith('speedReaderWords_')) {
        const bookId = key.replace('speedReaderWords_', '').split('_chunk_')[0];
        if (!validBookIds.has(bookId)) {
          localStorage.removeItem(key);
          removedItems++;
          i--; // Adjust index since we're removing items while iterating
        }
      }
    }
    
    // 4. Check if current book ID is valid
    const currentBookId = localStorage.getItem("speedReaderCurrentBookId");
    if (currentBookId && !validBookIds.has(currentBookId)) {
      localStorage.removeItem("speedReaderCurrentBookId");
      console.log("Removed invalid current book ID reference");
    }
    
    console.log(`Cleanup complete. Removed ${removedItems} orphaned items from localStorage`);
  } catch (error) {
    console.error("Error cleaning up localStorage:", error);
  }
}; 