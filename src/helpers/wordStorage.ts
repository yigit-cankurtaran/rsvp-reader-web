/**
 * Helper functions for managing word storage in localStorage
 */

/**
 * Check if localStorage is available and working
 * @returns Boolean indicating if storage is available
 */
export const isStorageAvailable = (): boolean => {
  try {
    const testKey = 'speedReader_test';
    localStorage.setItem(testKey, 'test');
    const result = localStorage.getItem(testKey) === 'test';
    localStorage.removeItem(testKey);
    return result;
  } catch (e) {
    console.error('localStorage is not available:', e);
    return false;
  }
};

/**
 * Check localStorage usage and estimate remaining space
 * @returns Object with usage information
 */
export const checkStorageUsage = (): { 
  used: number; 
  total: number; 
  usedPercent: number;
  items: number;
  hasSpace: boolean;
} => {
  try {
    // These are estimates, as browsers don't expose actual quota
    const total = 5 * 1024 * 1024; // Assume 5MB total (common limit)
    let used = 0;
    
    // Calculate current usage
    Object.keys(localStorage).forEach(key => {
      const value = localStorage.getItem(key) || '';
      used += key.length * 2 + value.length * 2; // UTF-16 characters = 2 bytes
    });
    
    return {
      used: used,
      total: total,
      usedPercent: Math.round((used / total) * 100),
      items: Object.keys(localStorage).length,
      hasSpace: used < (total * 0.9) // Consider 90% full as "no space left"
    };
  } catch (e) {
    console.error('Error checking storage usage:', e);
    return { used: 0, total: 0, usedPercent: 0, items: 0, hasSpace: false };
  }
};

/**
 * Attempt to free up localStorage space by removing old items
 * @returns Boolean indicating if space was freed
 */
export const cleanupStorage = (): boolean => {
  try {
    const keys = Object.keys(localStorage);
    if (keys.length === 0) return false;
    
    // Find and remove old chunk data that might be orphaned
    const orphanedChunks = keys.filter(key => 
      key.includes('speedReaderWords_') && 
      key.includes('_chunk_') &&
      !keys.includes(key.substring(0, key.lastIndexOf('_chunk_')))
    );
    
    if (orphanedChunks.length > 0) {
      console.log(`Removing ${orphanedChunks.length} orphaned chunks`);
      orphanedChunks.forEach(key => localStorage.removeItem(key));
      return true;
    }
    
    return false;
  } catch (e) {
    console.error('Error cleaning up storage:', e);
    return false;
  }
};

/**
 * Log the storage status for a book
 * @param bookId The book ID to check
 */
export const debugStorageForBook = (bookId: string): void => {
  try {
    const keys = Object.keys(localStorage).filter(key => 
      key.includes('speedReader') || key.includes(bookId)
    );
    
    const usage = checkStorageUsage();
    
    console.group('Storage Debug for Book: ' + bookId);
    console.log('Storage available:', isStorageAvailable());
    console.log(`Storage usage: ${(usage.used / 1024).toFixed(1)}KB / ${(usage.total / 1024).toFixed(1)}KB (${usage.usedPercent}%)`);
    console.log('Total items in localStorage:', Object.keys(localStorage).length);
    console.log('SpeedReader related items:', keys.length);
    
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      let displayValue: string;
      
      if (value && value.length > 100) {
        displayValue = `${value.substring(0, 50)}... (${value.length} chars)`;
      } else {
        displayValue = value || 'null';
      }
      
      console.log(`- ${key}: ${displayValue}`);
    });
    
    console.groupEnd();
  } catch (e) {
    console.error('Error debugging storage:', e);
  }
};

/**
 * Save words for a specific book
 * @param bookId The book ID to save words for
 * @param words Array of words to save
 * @returns boolean indicating success
 */
export const saveWordsForBook = (bookId: string, words: string[]): boolean => {
  try {
    if (!isStorageAvailable()) {
      console.error('Cannot save words, localStorage is not available');
      return false;
    }
    
    if (!bookId || !words || !Array.isArray(words)) {
      console.error("Invalid parameters for saveWordsForBook", { bookId, wordCount: words?.length });
      return false;
    }
    
    const key = `speedReaderWords_${bookId}`;
    
    // If the word array is very large, we'll split it into chunks to avoid storage limits
    if (words.length > 10000) {
      // Store the total count in the main key
      localStorage.setItem(key, JSON.stringify({
        totalChunks: Math.ceil(words.length / 10000),
        totalWords: words.length
      }));
      
      // Store the chunks
      const chunks = Math.ceil(words.length / 10000);
      for (let i = 0; i < chunks; i++) {
        const chunkWords = words.slice(i * 10000, (i + 1) * 10000);
        localStorage.setItem(`${key}_chunk_${i}`, JSON.stringify(chunkWords));
      }
      
      console.log(`Saved ${words.length} words in ${chunks} chunks for book ID ${bookId}`);
    } else {
      // For smaller arrays, store directly
      localStorage.setItem(key, JSON.stringify(words));
      console.log(`Saved ${words.length} words for book ID ${bookId} at key ${key}`);
    }
    
    return true;
  } catch (error) {
    console.error("Error saving words for book:", error);
    return false;
  }
};

/**
 * Load words for a specific book
 * @param bookId The book ID to load words for
 * @returns Array of words or null if not found
 */
export const loadWordsForBook = (bookId: string): string[] | null => {
  try {
    if (!isStorageAvailable()) {
      console.error('Cannot load words, localStorage is not available');
      return null;
    }
    
    if (!bookId) {
      console.error("Invalid bookId for loadWordsForBook");
      return null;
    }
    
    const key = `speedReaderWords_${bookId}`;
    const savedWords = localStorage.getItem(key);
    
    if (!savedWords) {
      console.warn(`No words found for book ID: ${bookId} at key ${key}`);
      return null;
    }
    
    const parsedData = JSON.parse(savedWords);
    
    // Check if we stored chunks
    if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
      const allWords: string[] = [];
      
      // Load all chunks
      for (let i = 0; i < parsedData.totalChunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        const chunkData = localStorage.getItem(chunkKey);
        
        if (chunkData) {
          const chunkWords = JSON.parse(chunkData);
          if (Array.isArray(chunkWords)) {
            allWords.push(...chunkWords);
          }
        }
      }
      
      if (allWords.length > 0) {
        console.log(`Loaded ${allWords.length} words (from chunks) for book ID ${bookId}`);
        return allWords;
      }
      
      return null;
    }
    
    // Handle regular non-chunked words
    if (Array.isArray(parsedData)) {
      console.log(`Loaded ${parsedData.length} words for book ID ${bookId}`);
      return parsedData;
    }
    
    console.warn(`Invalid words array for book ID: ${bookId}`, parsedData);
    return null;
  } catch (error) {
    console.error("Error loading words for book:", error);
    return null;
  }
};

/**
 * Create error words for a book that needs to be re-uploaded
 * @param bookId The book ID to create error words for
 * @returns Array of error words
 */
export const createErrorWords = (bookId: string): string[] => {
  const errorMessage = "Book content not available. Please re-upload the EPUB file.";
  const errorWords = errorMessage.split(" ");
  
  // Save these error words
  saveWordsForBook(bookId, errorWords);
  
  return errorWords;
};

/**
 * Clear all word storage for a book
 * @param bookId The book ID to clear words for
 */
export const clearWordsForBook = (bookId: string): void => {
  try {
    if (!isStorageAvailable()) {
      console.error('Cannot clear words, localStorage is not available');
      return;
    }
    
    const key = `speedReaderWords_${bookId}`;
    const savedWords = localStorage.getItem(key);
    
    // If we stored chunks, clear them all
    if (savedWords) {
      const parsedData = JSON.parse(savedWords);
      if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
        for (let i = 0; i < parsedData.totalChunks; i++) {
          localStorage.removeItem(`${key}_chunk_${i}`);
        }
      }
    }
    
    localStorage.removeItem(key);
    console.log(`Cleared words for book ID ${bookId}`);
  } catch (error) {
    console.error("Error clearing words for book:", error);
  }
}; 