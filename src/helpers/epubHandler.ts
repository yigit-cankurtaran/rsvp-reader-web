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
    
    // EPUB Standard: First locate container.xml to find the OPF file
    let rootFile = "";
    try {
      const containerFile = contents.files["META-INF/container.xml"];
      if (containerFile) {
        const containerXml = await containerFile.async("text");
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, "text/xml");
        rootFile = doc.querySelector("rootfile")?.getAttribute("full-path") || "";
      }
    } catch (error) {
      console.warn("Error reading container.xml:", error);
    }
    
    // Find all content files from the OPF file
    let contentFiles: JSZip.JSZipObject[] = [];
    let baseHref = "";
    
    if (rootFile) {
      try {
        baseHref = rootFile.substring(0, rootFile.lastIndexOf('/') + 1);
        const opfFile = contents.files[rootFile];
        if (opfFile) {
          const opfContent = await opfFile.async("text");
          const parser = new DOMParser();
          const doc = parser.parseFromString(opfContent, "text/xml");
          
          // Get the spine which defines the reading order
          const itemrefs = Array.from(doc.querySelectorAll("spine itemref"));
          const idToHref = new Map();
          
          // Get all items from the manifest
          Array.from(doc.querySelectorAll("manifest item")).forEach(item => {
            const id = item.getAttribute("id");
            const href = item.getAttribute("href");
            if (id && href) {
              idToHref.set(id, href);
            }
          });
          
          // Follow the spine order
          const spineHrefs = itemrefs
            .map(itemref => {
              const idref = itemref.getAttribute("idref");
              return idref ? idToHref.get(idref) : null;
            })
            .filter(href => href);
          
          // Convert hrefs to full paths and get the corresponding files
          contentFiles = spineHrefs
            .map(href => {
              const fullPath = baseHref + href;
              return contents.files[fullPath];
            })
            .filter(file => file && !file.dir);
        }
      } catch (error) {
        console.warn("Error processing OPF file:", error);
      }
    }
    
    // If no spine was found or something went wrong, fall back to finding HTML files
    if (contentFiles.length === 0) {
      console.log("No content files found from OPF, falling back to file search");
      contentFiles = Object.values(contents.files).filter(
        file => !file.dir && 
          (file.name.endsWith(".html") || 
           file.name.endsWith(".xhtml") || 
           file.name.endsWith(".htm")) &&
          !file.name.toLowerCase().includes("toc")
      );
      
      // Sort files alphabetically as a reasonable fallback
      contentFiles.sort((a, b) => {
        // First try to extract numbers
        const aMatch = a.name.match(/(\d+)/g);
        const bMatch = b.name.match(/(\d+)/g);
        
        if (aMatch && bMatch) {
          for (let i = 0; i < Math.min(aMatch.length, bMatch.length); i++) {
            const aNum = parseInt(aMatch[i], 10);
            const bNum = parseInt(bMatch[i], 10);
            if (aNum !== bNum) {
              return aNum - bNum;
            }
          }
        }
        
        // Fall back to alphabetical sorting
        return a.name.localeCompare(b.name);
      });
    }
    
    // Still no content files? Try one more approach - any HTML file
    if (contentFiles.length === 0) {
      contentFiles = Object.values(contents.files).filter(
        file => !file.dir && file.name.match(/\.(html|xhtml|htm|xml)$/i)
      );
    }
    
    // If we still have no content files, we can't process this EPUB
    if (contentFiles.length === 0) {
      console.error("No readable content files found in EPUB");
      throw new Error("No readable content files found in EPUB");
    }
    
    // Extract content from files
    let allText = "";
    let allWords: string[] = [];
    let extractedChapters: Chapter[] = [];
    let currentIndex = 0;
    let chapterCounter = 1;
    
    for (const file of contentFiles) {
      try {
        const content = await file.async("text");
        const parser = new DOMParser();
        
        // Handle both HTML and XML content
        const mimeType = file.name.endsWith(".xml") ? "text/xml" : "text/html";
        const doc = parser.parseFromString(content, mimeType);
        
        // Clean up the document
        doc.querySelectorAll("style, script, meta, link").forEach(el => el.remove());
        
        // Find a suitable title for the chapter
        let chapterTitle = 
          doc.querySelector("h1, h2, h3, h4, title")?.textContent?.trim() ||
          file.name.split("/").pop()?.replace(/\.(x?html|htm|xml)$/i, "") ||
          `Chapter ${chapterCounter++}`;
        
        // Get text content - handle both HTML and XML documents
        let text = "";
        if (doc.body) {
          text = doc.body.textContent || "";
        } else {
          // For XML documents that don't have a body
          text = doc.documentElement.textContent || "";
        }
        
        // Only process if there's meaningful text
        text = text.trim();
        if (text.length > 20) {
          const words = processText(text);
          
          if (words.length > 0) {
            extractedChapters.push({
              title: chapterTitle,
              startIndex: currentIndex,
              endIndex: currentIndex + words.length - 1,
            });
            
            allText += " " + text;
            allWords = [...allWords, ...words];
            currentIndex += words.length;
          }
        }
      } catch (fileError) {
        console.error(`Error processing EPUB file ${file.name}:`, fileError);
        // Continue with next file
      }
    }
    
    // If no chapters were successfully extracted, try a last-resort approach
    if (extractedChapters.length === 0) {
      // Try to extract text from any file
      let rawText = "";
      for (const fileName in contents.files) {
        if (!contents.files[fileName].dir && 
            !fileName.match(/\.(png|jpg|jpeg|gif|css|js|font|woff|ttf|otf)$/i)) {
          try {
            const fileText = await contents.files[fileName].async("text");
            if (fileText && fileText.length > 100) { // More likely to be content
              // Clean up XML/HTML tags for readability
              const cleanText = fileText
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim();
              
              if (cleanText.length > rawText.length) {
                rawText = cleanText;
              }
            }
          } catch (e) {
            // Skip files that can't be read as text
          }
        }
      }
      
      if (rawText) {
        const words = processText(rawText);
        if (words.length > 0) {
          extractedChapters.push({
            title: "Content",
            startIndex: 0,
            endIndex: words.length - 1,
          });
          allWords = words;
        }
      }
    }
    
    // If we still have no content, provide a fallback message
    if (allWords.length === 0) {
      const fallbackWords = ["This", "EPUB", "file", "has", "a", "structure", "that", "could", "not", "be", "parsed", "correctly."];
      extractedChapters = [{
        title: "Error",
        startIndex: 0,
        endIndex: fallbackWords.length - 1,
      }];
      allWords = fallbackWords;
    }
    
    return {
      text: allWords.join(" "),
      chapters: extractedChapters,
    };
  } catch (error) {
    console.error("Error parsing EPUB:", error);
    // Return minimal content rather than throwing
    const fallbackWords = ["This", "EPUB", "file", "could", "not", "be", "parsed", "correctly."];
    return {
      text: fallbackWords.join(" "),
      chapters: [{
        title: "Error",
        startIndex: 0,
        endIndex: fallbackWords.length - 1,
      }],
    };
  }
};

// Helper function to get text content from multiple selectors
function getTextContentFromSelectors(doc: Document, selectors: string[]): string {
  for (const selector of selectors) {
    try {
      const element = doc.querySelector(selector);
      if (element && element.textContent) {
        return element.textContent.trim();
      }
    } catch (e) {
      // Continue to next selector if this one fails
    }
  }
  return "";
}

// Helper function to convert blob to data URL
async function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export const extractEpubMetadata = async (file: File): Promise<{
  title: string;
  author: string;
  coverUrl: string | null;
}> => {
  try {
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);
    
    // First locate container.xml to find the OPF file (standard EPUB structure)
    let rootFilePath = "";
    try {
      const containerFile = contents.files["META-INF/container.xml"];
      if (containerFile) {
        const containerXml = await containerFile.async("text");
        const parser = new DOMParser();
        const doc = parser.parseFromString(containerXml, "text/xml");
        rootFilePath = doc.querySelector("rootfile")?.getAttribute("full-path") || "";
      }
    } catch (error) {
      console.warn("Error reading container.xml:", error);
    }
    
    // If we found the root file path, use it to locate the OPF file
    let opfFile: JSZip.JSZipObject | null = rootFilePath ? contents.files[rootFilePath] || null : null;
    
    // If no opf file found via container.xml, search for it directly
    if (!opfFile) {
      const foundFile = Object.values(contents.files).find(
        file => !file.dir && file.name.match(/\.opf$/i)
      );
      opfFile = foundFile || null;
    }
    
    if (!opfFile) {
      console.warn("No OPF file found in EPUB");
      return { title: file.name.replace(/\.epub$/i, "").replace(/_/g, " "), author: "Unknown", coverUrl: null };
    }
    
    const opfContent = await opfFile.async("text");
    const parser = new DOMParser();
    const doc = parser.parseFromString(opfContent, "text/xml");
    
    // Extract title - try multiple selectors for different EPUB versions
    let title = getTextContentFromSelectors(doc, [
      "dc\\:title", 
      "title",
      "metadata title",
      "[property='dcterms:title']",
      "[property='dc:title']"
    ]);
    
    if (!title) {
      title = file.name.replace(/\.epub$/i, "").replace(/_/g, " ");
    }
    
    // Extract author - try multiple selectors for different EPUB versions
    let author = getTextContentFromSelectors(doc, [
      "dc\\:creator", 
      "creator",
      "metadata creator",
      "[property='dcterms:creator']",
      "[property='dc:creator']"
    ]);
    
    if (!author) {
      author = "Unknown";
    }
    
    // Determine the base directory for resolving relative paths
    const baseDir = rootFilePath.substring(0, rootFilePath.lastIndexOf('/') + 1);
    
    // Find cover image using multiple approaches
    let coverUrl = null;
    
    // Method 1: Look for item with cover properties or id
    const coverSelectors = [
      "item[id='cover-image']",
      "item[id='cover']",
      "item[properties='cover-image']",
      "item[media-type^='image/'][id*='cover']",
      "reference[type='cover']"
    ];
    
    for (const selector of coverSelectors) {
      const coverItem = doc.querySelector(selector);
      if (coverItem) {
        const href = coverItem.getAttribute("href");
        if (href) {
          const coverPath = baseDir + href.replace(/#.*$/, "");
          const coverFile = contents.files[coverPath] || 
                          Object.values(contents.files).find(f => f.name.endsWith(href));
          
          if (coverFile) {
            const coverBlob = await coverFile.async("blob");
            // Convert blob to data URL instead of object URL
            coverUrl = await blobToDataURL(coverBlob);
            break;
          }
        }
      }
    }
    
    // Method 2: Look for a meta element specifying the cover
    if (!coverUrl) {
      const coverMeta = doc.querySelector("meta[name='cover']");
      if (coverMeta) {
        const coverId = coverMeta.getAttribute("content");
        if (coverId) {
          const coverItem = doc.querySelector(`item[id='${coverId}']`);
          if (coverItem) {
            const href = coverItem.getAttribute("href");
            if (href) {
              const coverPath = baseDir + href;
              const coverFile = contents.files[coverPath] || 
                              Object.values(contents.files).find(f => f.name.endsWith(href));
              
              if (coverFile) {
                const coverBlob = await coverFile.async("blob");
                // Convert blob to data URL instead of object URL
                coverUrl = await blobToDataURL(coverBlob);
              }
            }
          }
        }
      }
    }
    
    // Method 3: If no cover found yet, look for image files with "cover" in the name
    if (!coverUrl) {
      const imageFiles = Object.values(contents.files).filter(
        file => !file.dir && file.name.match(/\.(jpg|jpeg|png|gif)$/i)
      );
      
      const coverImage = imageFiles.find(file => 
        file.name.toLowerCase().includes("cover") || 
        file.name.toLowerCase().includes("title")
      ) || imageFiles[0]; // Fallback to first image
      
      if (coverImage) {
        const coverBlob = await coverImage.async("blob");
        // Convert blob to data URL instead of object URL
        coverUrl = await blobToDataURL(coverBlob);
      }
    }
    
    return { title, author, coverUrl };
  } catch (error) {
    console.error("Error extracting EPUB metadata:", error);
    return { 
      title: file.name.replace(/\.epub$/i, "").replace(/_/g, " "), 
      author: "Unknown", 
      coverUrl: null 
    };
  }
};

export const createBookFromEpub = async (file: File, epubContent: { text: string; chapters: Chapter[] }): Promise<Book> => {
  try {
    // Extract metadata - this should now be more robust
    const metadata = await extractEpubMetadata(file);
    
    // Process words, ensuring we at least have some content
    let words = processText(epubContent.text);
    if (words.length === 0) {
      // If no words were extracted, create a placeholder
      words = ["This", "EPUB", "file", "could", "not", "be", "processed", "correctly."];
    }
    
    // Create a book with a unique ID based on filename and timestamp
    // Using both ensures uniqueness even if the same file is uploaded multiple times
    const timestamp = Date.now();
    const filenamePart = file.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    
    return {
      id: `book_${filenamePart}_${timestamp}`,
      fileName: file.name,
      title: metadata.title || file.name.replace(/\.epub$/i, "").replace(/_/g, " "),
      author: metadata.author || "Unknown",
      coverUrl: metadata.coverUrl,
      totalWords: words.length,
      currentWordIndex: 0,
      lastReadDate: new Date().toISOString(),
      chapters: epubContent.chapters.length > 0 ? epubContent.chapters : [
        { 
          title: "Content", 
          startIndex: 0, 
          endIndex: words.length - 1 
        }
      ]
    };
  } catch (error) {
    console.error("Error creating book from EPUB:", error);
    
    // Always return a valid book object, even on error
    const fallbackWords = ["This", "EPUB", "file", "could", "not", "be", "processed", "correctly."];
    return {
      id: `book_${Date.now()}`,
      fileName: file.name,
      title: file.name.replace(/\.epub$/i, "").replace(/_/g, " "),
      author: "Unknown",
      coverUrl: null,
      totalWords: fallbackWords.length,
      currentWordIndex: 0,
      lastReadDate: new Date().toISOString(),
      chapters: [{ 
        title: "Content", 
        startIndex: 0, 
        endIndex: fallbackWords.length - 1 
      }]
    };
  }
};
