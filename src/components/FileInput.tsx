import React, { useEffect } from "react";
import { extractEpubContent } from "../helpers/epubHandler";
import { processText } from "../helpers/textProcessor";
import { FileInputProps } from "../types/reader";
import JSZip from "jszip";
import logger from "../helpers/logger";

// Create a module-specific logger
const log = logger.forModule("FileInput");

const FileInput: React.FC<FileInputProps> = ({
  onFileProcessed,
  acceptFormats = ".epub",
}) => {
  // Debug log on component mount
  useEffect(() => {
    log.debug("FileInput mounted for EPUB handling");
  }, []);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      // Validate that it's a proper EPUB file
      if (!file.name.toLowerCase().endsWith(".epub")) {
        alert("Please select a valid EPUB file (.epub)");
        return;
      }

      log.info(
        `Processing EPUB file: ${file.name} (${Math.round(file.size / 1024)} KB)`
      );

      try {
        const epubContent = await extractEpubContent(file);

        if (
          epubContent.text.trim().length === 0 ||
          epubContent.chapters.length === 0
        ) {
          throw new Error("Empty content extracted from EPUB");
        }

        // Process was successful
        onFileProcessed(
          {
            text: epubContent.text,
            words: processText(epubContent.text),
            fileName: file.name,
            chapters: epubContent.chapters,
          },
          file
        );
      } catch (epubError) {
        log.error("Error extracting EPUB content:", epubError);

        // If there's an error, try a different approach
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const zip = new JSZip();
            await zip.loadAsync(arrayBuffer);

            // If we get here, it's at least a valid zip file
            const fallbackText = `This EPUB file could not be fully processed. It may have an unusual structure.`;
            const fallbackWords = processText(fallbackText);

            onFileProcessed(
              {
                text: fallbackText,
                words: fallbackWords,
                fileName: file.name,
                chapters: [
                  {
                    title: "Content",
                    startIndex: 0,
                    endIndex: fallbackWords.length - 1,
                  },
                ],
              },
              file
            );
          } catch (zipError) {
            console.error("Not a valid zip file:", zipError);
            alert(
              `The file doesn't appear to be a valid EPUB. EPUBs are ZIP files containing HTML content.`
            );
          }
        };
        reader.onerror = () => {
          alert("Error reading the file. Please try another EPUB.");
        };
        reader.readAsArrayBuffer(file);
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("There was an error processing the file. Please try again.");
    }
  };

  return (
    <div className="file-control-wrapper">
      <div className="file-control">
        <label className="file-input-label">
          Choose EPUB File
          <input
            type="file"
            onChange={handleFileUpload}
            className="file-input"
            accept={acceptFormats}
          />
        </label>
      </div>
    </div>
  );
};

export default FileInput;
