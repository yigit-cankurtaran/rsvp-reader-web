/**
 * Helper functions for managing word storage in localStorage
 */

/**
 * Save words for a specific book
 * @param bookId The book ID to save words for
 * @param words Array of words to save
 * @returns boolean indicating success
 */
export const saveWordsForBook = (bookId: string, words: string[]): boolean => {
  try {
    if (!bookId || !words || !Array.isArray(words)) {
      console.error("Invalid parameters for saveWordsForBook", { bookId, wordCount: words?.length });
      return false;
    }
    
    const key = `speedReaderWords_${bookId}`;
    localStorage.setItem(key, JSON.stringify(words));
    console.log(`Saved ${words.length} words for book ID ${bookId} at key ${key}`);
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
    
    const parsedWords = JSON.parse(savedWords);
    
    if (!Array.isArray(parsedWords) || parsedWords.length === 0) {
      console.warn(`Invalid words array for book ID: ${bookId}`, parsedWords);
      return null;
    }
    
    console.log(`Loaded ${parsedWords.length} words for book ID ${bookId} from key ${key}`);
    return parsedWords;
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
    localStorage.removeItem(`speedReaderWords_${bookId}`);
    console.log(`Cleared words for book ID ${bookId}`);
  } catch (error) {
    console.error("Error clearing words for book:", error);
  }
}; 