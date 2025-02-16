import JSZip from "jszip";
import { processText } from "./textProcessor";
import { Chapter } from "../types/reader";

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
