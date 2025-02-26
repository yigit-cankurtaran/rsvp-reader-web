import Dexie from 'dexie';
import { Book } from '../types/reader';

// Define database schema and interface
export interface WordChunk {
  id: string; // Format: bookId_chunkIndex
  bookId: string;
  chunkIndex: number;
  words: string[];
}

export interface AppSettings {
  id: string; // 'appSettings'
  wpm: number;
  theme: 'light' | 'dark';
  inputType: string;
}

export interface BookProgress {
  id: string; // bookId
  currentWordIndex: number;
  currentChapter: number;
  lastReadDate: string;
}

// Define database
class SpeedReaderDatabase extends Dexie {
  books!: Dexie.Table<Book, string>; // Primary key is id
  wordChunks!: Dexie.Table<WordChunk, string>; // Primary key is id
  settings!: Dexie.Table<AppSettings, string>; // Primary key is id
  bookProgress!: Dexie.Table<BookProgress, string>; // Primary key is id (bookId)

  constructor() {
    super('SpeedReaderDB');
    
    // Define tables and indexes
    this.version(1).stores({
      books: 'id, fileName, title, author, lastReadDate',
      wordChunks: 'id, bookId, chunkIndex',
      settings: 'id',
      bookProgress: 'id'
    });
  }
}

// Create and export DB instance
export const db = new SpeedReaderDatabase();

// Helper functions
export async function migrateFromLocalStorage() {
  console.log('Starting migration from localStorage to IndexedDB');
  
  try {
    // Check if we've already migrated
    const migrationFlag = localStorage.getItem('speedReaderMigrated');
    if (migrationFlag === 'true') {
      console.log('Migration already completed');
      return true;
    }
    
    // 1. Migrate library/books
    const libraryData = localStorage.getItem('speedReaderLibrary');
    if (libraryData) {
      const books: Book[] = JSON.parse(libraryData);
      console.log(`Migrating ${books.length} books from library`);
      
      // Save all books to IndexedDB
      await db.books.bulkPut(books);
    }
    
    // 2. Migrate book content (words)
    const wordKeys = Object.keys(localStorage).filter(
      key => key.startsWith('speedReaderWords_')
    );
    
    for (const key of wordKeys) {
      try {
        const bookId = key.replace('speedReaderWords_', '');
        
        // Skip chunk keys, we'll handle them separately
        if (key.includes('_chunk_')) continue;
        
        const data = localStorage.getItem(key);
        if (!data) continue;
        
        const parsedData = JSON.parse(data);
        
        // Check if it's chunked data
        if (parsedData && typeof parsedData === 'object' && parsedData.totalChunks) {
          // Handle chunked words
          const { totalChunks } = parsedData;
          console.log(`Migrating ${totalChunks} chunks for book ${bookId}`);
          
          for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `${key}_chunk_${i}`;
            const chunkData = localStorage.getItem(chunkKey);
            
            if (chunkData) {
              const words = JSON.parse(chunkData);
              if (Array.isArray(words)) {
                await db.wordChunks.put({
                  id: `${bookId}_${i}`,
                  bookId,
                  chunkIndex: i,
                  words
                });
              }
            }
          }
        } else if (Array.isArray(parsedData)) {
          // Handle regular non-chunked words
          await db.wordChunks.put({
            id: `${bookId}_0`,
            bookId,
            chunkIndex: 0,
            words: parsedData
          });
        }
      } catch (error) {
        console.error(`Error migrating word data for ${key}:`, error);
      }
    }
    
    // 3. Migrate settings
    const settings: AppSettings = {
      id: 'appSettings',
      wpm: parseInt(localStorage.getItem('speedReaderWpm') || '300', 10),
      theme: localStorage.getItem('speedReaderTheme') === 'dark' ? 'dark' : 'light',
      inputType: localStorage.getItem('speedReaderInputType') || 'TEXT'
    };
    
    await db.settings.put(settings);
    
    // 4. Migrate current book progress if exists
    const currentBookId = localStorage.getItem('speedReaderCurrentBookId');
    if (currentBookId) {
      const progress: BookProgress = {
        id: currentBookId,
        currentWordIndex: parseInt(localStorage.getItem('speedReaderProgress') || '0', 10),
        currentChapter: parseInt(localStorage.getItem('speedReaderCurrentChapter') || '0', 10),
        lastReadDate: new Date().toISOString()
      };
      
      await db.bookProgress.put(progress);
    }
    
    // Mark migration as complete
    localStorage.setItem('speedReaderMigrated', 'true');
    console.log('Migration completed successfully');
    return true;
  } catch (error) {
    console.error('Error during migration:', error);
    return false;
  }
}

// Database operations for books
export async function getAllBooks(): Promise<Book[]> {
  return await db.books.toArray();
}

export async function getBookById(id: string): Promise<Book | undefined> {
  return await db.books.get(id);
}

export async function addOrUpdateBook(book: Book): Promise<string> {
  // Check if book with same filename already exists
  const existingBook = await db.books.where('fileName').equals(book.fileName).first();
  
  if (existingBook) {
    // Update existing book but preserve the ID
    const updatedBook = {
      ...book,
      id: existingBook.id
    };
    await db.books.put(updatedBook);
    return updatedBook.id;
  } else {
    // Add new book
    await db.books.put(book);
    return book.id;
  }
}

export async function removeBookFromDB(id: string): Promise<void> {
  // Remove book
  await db.books.delete(id);
  
  // Also remove associated word chunks
  await db.wordChunks.where('bookId').equals(id).delete();
  
  // And book progress
  await db.bookProgress.delete(id);
}

export async function updateBookProgressInDB(id: string, currentWordIndex: number): Promise<void> {
  // Update book in books table
  const book = await db.books.get(id);
  if (book) {
    book.currentWordIndex = currentWordIndex;
    book.lastReadDate = new Date().toISOString();
    await db.books.put(book);
  }
  
  // Update dedicated progress entry
  const progress = await db.bookProgress.get(id) || {
    id,
    currentWordIndex,
    currentChapter: 0,
    lastReadDate: new Date().toISOString()
  };
  
  progress.currentWordIndex = currentWordIndex;
  progress.lastReadDate = new Date().toISOString();
  await db.bookProgress.put(progress);
}

// Database operations for word chunks
export async function saveWordsForBook(bookId: string, words: string[]): Promise<boolean> {
  try {
    // Clear existing chunks first
    await db.wordChunks.where('bookId').equals(bookId).delete();
    
    // If array is large, split into chunks of 10000 words
    if (words.length > 10000) {
      const chunks = Math.ceil(words.length / 10000);
      
      for (let i = 0; i < chunks; i++) {
        const chunkWords = words.slice(i * 10000, (i + 1) * 10000);
        await db.wordChunks.put({
          id: `${bookId}_${i}`,
          bookId,
          chunkIndex: i,
          words: chunkWords
        });
      }
      
      console.log(`Saved ${words.length} words in ${chunks} chunks for book ID ${bookId}`);
    } else {
      // For smaller arrays, store in a single chunk
      await db.wordChunks.put({
        id: `${bookId}_0`,
        bookId, 
        chunkIndex: 0,
        words
      });
      console.log(`Saved ${words.length} words for book ID ${bookId}`);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving words for book:', error);
    return false;
  }
}

export async function loadWordsForBook(bookId: string): Promise<string[] | null> {
  try {
    // Get all chunks for this book, ordered by chunkIndex
    const chunks = await db.wordChunks
      .where('bookId')
      .equals(bookId)
      .sortBy('chunkIndex');
    
    if (!chunks || chunks.length === 0) {
      console.warn(`No word chunks found for book ID: ${bookId}`);
      return null;
    }
    
    // Combine all chunks into a single array
    const allWords: string[] = [];
    chunks.forEach(chunk => {
      allWords.push(...chunk.words);
    });
    
    console.log(`Loaded ${allWords.length} words for book ID ${bookId}`);
    return allWords;
  } catch (error) {
    console.error('Error loading words for book:', error);
    return null;
  }
}

export async function clearWordsForBook(bookId: string): Promise<void> {
  try {
    await db.wordChunks.where('bookId').equals(bookId).delete();
    console.log(`Cleared words for book ID ${bookId}`);
  } catch (error) {
    console.error('Error clearing words for book:', error);
  }
}

// Settings operations
export async function getAppSettings(): Promise<AppSettings> {
  const settings = await db.settings.get('appSettings');
  return settings || {
    id: 'appSettings',
    wpm: 300,
    theme: 'light',
    inputType: 'TEXT'
  };
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const currentSettings = await getAppSettings();
  await db.settings.put({
    ...currentSettings,
    ...settings
  });
}

// Get storage usage information
export async function checkDBStorageUsage(): Promise<{
  usage: number;
  bookCount: number;
  chunkCount: number;
}> {
  const books = await db.books.count();
  const chunks = await db.wordChunks.count();
  
  // We can't get actual storage usage without the experimental estimate() API,
  // but we can track the number of items as a proxy
  return {
    usage: 0, // Placeholder, can't get accurate usage
    bookCount: books,
    chunkCount: chunks
  };
}

// Try to estimate the DB size based on the assumption that
// IndexedDB is faster and doesn't need to be monitored as closely
export async function isStorageLow(): Promise<boolean> {
  try {
    // This is just an approximate way to check if storage might be low
    // We're assuming that with IndexedDB, we have much more space
    // So we only warn if we detect a very large number of chunks
    const chunkCount = await db.wordChunks.count();
    return chunkCount > 1000; // Arbitrary threshold
  } catch (error) {
    console.error('Error checking storage:', error);
    return false;
  }
} 