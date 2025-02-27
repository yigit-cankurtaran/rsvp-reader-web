/**
 * Helper functions for book data storage and retrieval
 */

import { 
  saveWordsForBook as saveWordsForBookDB,
  loadWordsForBook as loadWordsForBookDB
} from './dexieDB';

/**
 * Save words for a specific book
 * @param bookId The book ID
 * @param words Array of words to save
 * @returns True if successful
 */
export const saveWordsForBook = async (bookId: string, words: string[]): Promise<boolean> => {
  try {
    return await saveWordsForBookDB(bookId, words);
  } catch (error) {
    console.error(`Error saving words for book ${bookId}:`, error);
    return false;
  }
};

/**
 * Get words for a specific book
 * @param bookId The book ID
 * @returns Array of words or null if not found
 */
export const getWordsForBook = async (bookId: string): Promise<string[] | null> => {
  try {
    return await loadWordsForBookDB(bookId);
  } catch (error) {
    console.error(`Error loading words for book ${bookId}:`, error);
    return null;
  }
}; 