/**
 * Helper functions for managing word storage in IndexedDB (with localStorage fallback)
 */

import {
  db,
  saveWordsForBook as saveWordsForBookDB,
  loadWordsForBook as loadWordsForBookDB,
  clearWordsForBook as clearWordsForBookDB,
  checkDBStorageUsage,
  isStorageLow
} from './dexieDB';

// Constants
const CHUNK_SIZE = 10000; // Number of words per chunk
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB localStorage limit

/**
 * Check if localStorage is available and working
 * @returns Boolean indicating if storage is available
 */
export const isStorageAvailable = (): boolean => {
  if (typeof localStorage === "undefined") {
    return false;
  }
  
  try {
    const testKey = "__storage_test__";
    localStorage.setItem(testKey, testKey);
    localStorage.removeItem(testKey);
    return true;
  } catch (e) {
    return false;
  }
};

/**
 * Check localStorage usage and estimate remaining space
 * @returns Object with usage information
 */
export const checkStorageUsage = async (): Promise<{ used: number; total: number; usedPercent: number }> => {
  try {
    // First check IndexedDB usage
    const dbUsage = await checkDBStorageUsage();
    
    console.log(`IndexedDB usage: ${dbUsage.usage} bytes, ${dbUsage.bookCount} books, ${dbUsage.chunkCount} chunks`);
    
    // Then fallback to localStorage for older data
    if (isStorageAvailable()) {
      let totalSize = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          totalSize += (key.length + (value ? value.length : 0)) * 2; // UTF-16 chars are 2 bytes
        }
      }
      
      console.log(`localStorage usage: ${totalSize} bytes`);
      
      // Return combined storage usage
      const total = MAX_STORAGE_SIZE; // localStorage limit
      const used = Math.min(totalSize, MAX_STORAGE_SIZE); // Cap at max
      const usedPercent = Math.round((used / total) * 100);
      
      return { used, total, usedPercent };
    }
    
    // If localStorage is not available, return IndexedDB usage estimate
    // We don't have a fixed size limit for IndexedDB, but we'll use 50MB as a reference
    const ESTIMATED_INDEXEDDB_LIMIT = 50 * 1024 * 1024; // 50MB
    const usedPercent = Math.round((dbUsage.usage / ESTIMATED_INDEXEDDB_LIMIT) * 100);
    
    return {
      used: dbUsage.usage,
      total: ESTIMATED_INDEXEDDB_LIMIT,
      usedPercent: Math.min(usedPercent, 100) // Cap at 100%
    };
  } catch (error) {
    console.error("Error checking storage usage:", error);
    return { used: 0, total: MAX_STORAGE_SIZE, usedPercent: 0 };
  }
};

/**
 * Attempt to free up localStorage space by removing old items
 * @returns Boolean indicating if space was freed
 */
export const cleanupStorage = async (): Promise<boolean> => {
  try {
    // Clean up IndexedDB first
    console.log("Cleaning up storage...");
    
    // Get all books from IndexedDB
    const books = await db.books.toArray();
    const validBookIds = new Set(books.map(book => book.id));
    
    // Clear orphaned chunks in IndexedDB
    const chunks = await db.wordChunks.toArray();
    let orphanedChunks = 0;
    
    for (const chunk of chunks) {
      if (!validBookIds.has(chunk.bookId)) {
        await db.wordChunks.delete(chunk.id);
        orphanedChunks++;
      }
    }
    
    // Also clean up localStorage
    if (isStorageAvailable()) {
      let removed = 0;
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        
        if (key && key.startsWith('speedReaderWords_')) {
          const bookId = key.replace('speedReaderWords_', '').split('_chunk_')[0];
          
          if (!validBookIds.has(bookId)) {
            localStorage.removeItem(key);
            removed++;
            // Adjust the counter since we're modifying the array we're iterating
            i--;
          }
        }
      }
      
      console.log(`Cleaned up ${removed} orphaned items from localStorage`);
    }
    
    console.log(`Cleaned up ${orphanedChunks} orphaned chunks from IndexedDB`);
    return true;
  } catch (error) {
    console.error("Error cleaning up storage:", error);
    return false;
  }
};

/**
 * Log the storage status for a book
 * @param bookId The book ID to check
 */
export const debugStorageForBook = async (bookId: string): Promise<void> => {
  console.log(`Debugging storage for book ID: ${bookId}`);
  
  try {
    // Check IndexedDB first
    const chunks = await db.wordChunks.where('bookId').equals(bookId).toArray();
    
    if (chunks.length > 0) {
      console.log(`Found ${chunks.length} chunks in IndexedDB for book ID: ${bookId}`);
      console.log(`Total words in IndexedDB: ${chunks.reduce((total, chunk) => total + chunk.words.length, 0)}`);
    } else {
      console.log(`No chunks found in IndexedDB for book ID: ${bookId}`);
    }
    
    // Check localStorage
    if (isStorageAvailable()) {
      const data = localStorage.getItem(`speedReaderWords_${bookId}`);
      
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          
          if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
            console.log(`Found chunked data in localStorage: ${parsedData.totalChunks} chunks, ${parsedData.totalWords} words`);
          } else if (Array.isArray(parsedData)) {
            console.log(`Found ${parsedData.length} words in localStorage`);
          } else {
            console.log(`Found data in localStorage but format is unknown`);
          }
        } catch (e) {
          console.error(`Error parsing localStorage data for book ID ${bookId}:`, e);
        }
      } else {
        console.log(`No data found in localStorage for book ID: ${bookId}`);
      }
    }
  } catch (error) {
    console.error(`Error debugging storage for book ID ${bookId}:`, error);
  }
};

/**
 * Save words for a specific book, using IndexedDB with localStorage fallback
 * @param bookId The book ID to save words for
 * @param words Array of words to save
 * @returns boolean indicating success
 */
export const saveWordsForBook = async (bookId: string, words: string[]): Promise<boolean> => {
  if (!bookId || !words || words.length === 0) {
    console.error("Invalid book ID or words array");
    return false;
  }
  
  console.log(`Saving ${words.length} words for book ID: ${bookId}`);
  
  try {
    // First try to save to IndexedDB
    const saved = await saveWordsForBookDB(bookId, words);
    
    if (saved) {
      console.log(`Successfully saved words to IndexedDB for book ID: ${bookId}`);
      return true;
    }
    
    // If IndexedDB fails, try using localStorage (for backward compatibility)
    if (isStorageAvailable()) {
      // If the words are too many, we need to chunk them
      if (words.length > CHUNK_SIZE) {
        const chunks = Math.ceil(words.length / CHUNK_SIZE);
        const chunkInfo = {
          totalChunks: chunks,
          totalWords: words.length,
          dateCreated: new Date().toISOString()
        };
        
        // Save chunk info
        localStorage.setItem(`speedReaderWords_${bookId}`, JSON.stringify(chunkInfo));
        
        // Save each chunk
        for (let i = 0; i < chunks; i++) {
          const chunkWords = words.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          localStorage.setItem(`speedReaderWords_${bookId}_chunk_${i}`, JSON.stringify(chunkWords));
        }
        
        console.log(`Successfully chunked and saved ${words.length} words for book ID: ${bookId}`);
        return true;
      } else {
        // For smaller arrays, store directly
        localStorage.setItem(`speedReaderWords_${bookId}`, JSON.stringify(words));
        console.log(`Successfully saved ${words.length} words for book ID: ${bookId} to localStorage`);
        return true;
      }
    }
    
    // Both IndexedDB and localStorage failed
    return false;
  } catch (error) {
    console.error(`Error saving words for book ID ${bookId}:`, error);
    return false;
  }
};

/**
 * Load words for a specific book, using IndexedDB with localStorage fallback
 * @param bookId The book ID to load words for
 * @returns Array of words or null if not found
 */
export const loadWordsForBook = async (bookId: string): Promise<string[] | null> => {
  if (!bookId) {
    console.error("Invalid book ID");
    return null;
  }
  
  console.log(`Loading words for book ID: ${bookId}`);
  
  try {
    // First try to load from IndexedDB
    const words = await loadWordsForBookDB(bookId);
    
    if (words && words.length > 0) {
      console.log(`Successfully loaded ${words.length} words from IndexedDB for book ID: ${bookId}`);
      return words;
    }
    
    // If not found in IndexedDB, try localStorage (for backward compatibility)
    if (isStorageAvailable()) {
      const data = localStorage.getItem(`speedReaderWords_${bookId}`);
      
      if (!data) return null;
      
      try {
        const parsedData = JSON.parse(data);
        
        // Check if it's chunked data
        if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
          const { totalChunks, totalWords } = parsedData;
          let allWords: string[] = [];
          
          // Load each chunk
          for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `speedReaderWords_${bookId}_chunk_${i}`;
            const chunkData = localStorage.getItem(chunkKey);
            
            if (chunkData) {
              const chunkWords = JSON.parse(chunkData);
              if (Array.isArray(chunkWords)) {
                allWords = allWords.concat(chunkWords);
              }
            }
          }
          
          console.log(`Successfully loaded ${allWords.length} words from chunked localStorage for book ID: ${bookId}`);
          
          // While we're here, let's migrate this data to IndexedDB for next time
          saveWordsForBookDB(bookId, allWords).then(saved => {
            if (saved) {
              console.log(`Migrated words for book ID ${bookId} from localStorage to IndexedDB`);
            }
          });
          
          return allWords;
        } else if (Array.isArray(parsedData)) {
          // It's a regular array of words
          console.log(`Successfully loaded ${parsedData.length} words from localStorage for book ID: ${bookId}`);
          
          // Migrate to IndexedDB for next time
          saveWordsForBookDB(bookId, parsedData).then(saved => {
            if (saved) {
              console.log(`Migrated words for book ID ${bookId} from localStorage to IndexedDB`);
            }
          });
          
          return parsedData;
        }
      } catch (e) {
        console.error(`Error parsing words data for book ID ${bookId}:`, e);
        return null;
      }
    }
    
    // Not found in either storage
    console.log(`No words found for book ID: ${bookId}`);
    return null;
  } catch (error) {
    console.error(`Error loading words for book ID ${bookId}:`, error);
    return null;
  }
};

/**
 * Clear all word storage for a book
 * @param bookId The book ID to clear words for
 */
export const clearWordsForBook = async (bookId: string): Promise<void> => {
  if (!bookId) {
    console.error("Invalid book ID");
    return;
  }
  
  console.log(`Clearing words for book ID: ${bookId}`);
  
  try {
    // First clear from IndexedDB
    await clearWordsForBookDB(bookId);
    
    // Then clear from localStorage (for backward compatibility)
    if (isStorageAvailable()) {
      // Check if it's chunked data
      const data = localStorage.getItem(`speedReaderWords_${bookId}`);
      
      if (data) {
        try {
          const parsedData = JSON.parse(data);
          
          if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
            const { totalChunks } = parsedData;
            
            // Remove each chunk
            for (let i = 0; i < totalChunks; i++) {
              localStorage.removeItem(`speedReaderWords_${bookId}_chunk_${i}`);
            }
          }
        } catch (e) {
          // If it's not valid JSON, just proceed with removal
        }
        
        // Remove the main entry
        localStorage.removeItem(`speedReaderWords_${bookId}`);
      }
    }
    
    console.log(`Successfully cleared words for book ID: ${bookId}`);
  } catch (error) {
    console.error(`Error clearing words for book ID ${bookId}:`, error);
  }
};

/**
 * Create error words for a book that needs to be re-uploaded
 * @param bookId The book ID to create error words for
 * @returns Array of error words
 */
export const createErrorWords = async (bookId: string): Promise<string[]> => {
  const errorWords = [
    "Content",
    "for",
    "this",
    "book",
    "is",
    "not",
    "available",
    "in",
    "storage.",
    "Please",
    "re-upload",
    "the",
    "EPUB",
    "file",
    "to",
    "read",
    "it",
    "again."
  ];
  
  // Add book ID for debugging
  errorWords.push("(Book", "ID:", bookId + ")");
  
  return errorWords;
}; 