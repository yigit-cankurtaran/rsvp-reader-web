import JSZip from "jszip";
import { processText } from "./textProcessor";
import { Chapter, Book } from "../types/reader";

export const extractEpubContent = async (file: File): Promise<{
  text: string;
  chapters: Chapter[];
}> => {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    // Find and sort content files
    const contentFiles = Object.values(contents.files)
      .filter(
        (file) => file.name.endsWith(".html") || file.name.endsWith(".xhtml")
      )
      .sort((a, b) => {
        const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0", 10);
        const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0", 10);
        if (aNum === bNum) {
          return a.name.localeCompare(b.name);
        }
        return aNum - bNum;
      });

    let allWords: string[] = [];
    let extractedChapters: Chapter[] = [];
    let currentIndex = 0;
    let seenTitles = new Set<string>();

    // Extract text from all content files
    for (const file of contentFiles) {
      const content = await file.async("text");
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, "text/html");

      // Remove style and script tags
      doc.querySelectorAll("style, script").forEach((el) => el.remove());

      let chapterTitle =
        doc.querySelector("h1, h2, title")?.textContent?.trim() ||
        `Chapter ${extractedChapters.length + 1}`;

      if (seenTitles.has(chapterTitle)) {
        chapterTitle = `${chapterTitle} (${extractedChapters.length + 1})`;
      }
      seenTitles.add(chapterTitle);

      const text = doc.body.textContent || "";
      const words = processText(text);

      if (words.length > 0) {
        extractedChapters.push({
          title: chapterTitle,
          startIndex: currentIndex,
          endIndex: currentIndex + words.length - 1,
        });

        allWords = [...allWords, ...words];
        currentIndex += words.length;
      }
    }

    return {
      text: allWords.join(" "),
      chapters: extractedChapters,
    };
  } catch (error) {
    console.error("Error parsing EPUB:", error);
    throw new Error("Failed to parse EPUB file");
  }
};

export const extractEpubMetadata = async (file: File): Promise<{
  title: string;
  author: string;
  coverUrl: string | null;
}> => {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // Find the OPF file (content.opf or package.opf)
    const opfFile = Object.values(contents.files).find(
      (file) => file.name.endsWith(".opf")
    );
    
    if (!opfFile) {
      return { title: file.name, author: "Unknown", coverUrl: null };
    }
    
    const opfContent = await opfFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(opfContent, "text/xml");
    
    // Extract title and author
    const title = doc.querySelector("dc\\:title, title")?.textContent || file.name;
    const author = doc.querySelector("dc\\:creator, creator")?.textContent || "Unknown";
    
    // Find cover image
    let coverUrl = null;
    
    // Method 1: Look for cover image in manifest
    const coverItem = doc.querySelector('item[id="cover"], item[id="cover-image"], item[properties="cover-image"]');
    if (coverItem) {
      const coverId = coverItem.getAttribute("href");
      if (coverId) {
        const coverPath = new URL(coverId, new URL(opfFile.name, "file:///")).pathname;
        const coverFile = contents.files[coverPath.substring(1)] || 
                         Object.values(contents.files).find(f => f.name.endsWith(coverPath));
        
        if (coverFile) {
          const coverBlob = await coverFile.async("blob");
          coverUrl = URL.createObjectURL(coverBlob);
        }
      }
    }
    
    // Method 2: If no cover found, look for image with "cover" in the name
    if (!coverUrl) {
      const imageFiles = Object.values(contents.files).filter(
        file => file.name.match(/\.(jpg|jpeg|png|gif)$/i)
      );
      
      const coverImage = imageFiles.find(file => 
        file.name.toLowerCase().includes("cover") || 
        file.name.toLowerCase().includes("title")
      ) || imageFiles[0]; // Fallback to first image
      
      if (coverImage) {
        const coverBlob = await coverImage.async("blob");
        coverUrl = URL.createObjectURL(coverBlob);
      }
    }
    
    return { title, author, coverUrl };
  } catch (error) {
    console.error("Error extracting EPUB metadata:", error);
    return { title: file.name, author: "Unknown", coverUrl: null };
  }
};

export const createBookFromEpub = async (file: File, epubContent: { text: string; chapters: Chapter[] }): Promise<Book> => {
  const metadata = await extractEpubMetadata(file);
  const words = processText(epubContent.text);
  
  return {
    id: `book_${Date.now()}`,
    fileName: file.name,
    title: metadata.title,
    author: metadata.author,
    coverUrl: metadata.coverUrl,
    totalWords: words.length,
    currentWordIndex: 0,
    lastReadDate: new Date().toISOString(),
    chapters: epubContent.chapters
  };
};
