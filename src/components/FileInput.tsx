import React, { useState, useEffect } from "react";
import { extractEpubContent } from "../helpers/epubHandler";
import { processText } from "../helpers/textProcessor";
import { FileInputProps, InputType } from "../types/reader";
import JSZip from "jszip";
import logger from "../helpers/logger";

// Create a module-specific logger
const log = logger.forModule("FileInput");

const FileInput: React.FC<FileInputProps> = ({
  inputType,
  onFileProcessed,
}) => {
  const [textInput, setTextInput] = useState("");

  // Debug log on component mount to verify props
  useEffect(() => {
    log.debug(`FileInput mounted with inputType: ${inputType}`);
  }, [inputType]);

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      switch (inputType) {
        case InputType.EPUB:
          // Validate that it's a proper EPUB file first
          if (!file.name.toLowerCase().endsWith(".epub")) {
            alert("Please select a valid EPUB file (.epub)");
            return;
          }

          try {
            log.info(
              `Processing EPUB file: ${file.name} (${Math.round(file.size / 1024)} KB)`
            );
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
            // Read the file as an ArrayBuffer and check if it's a valid zip file
            const reader = new FileReader();
            reader.onload = async (e) => {
              try {
                // Try to process the file as a binary file
                const arrayBuffer = e.target?.result as ArrayBuffer;
                const zip = new JSZip();
                await zip.loadAsync(arrayBuffer);

                // If we get here, it's at least a valid zip file
                // Create a placeholder content
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
          break;

        case InputType.TEXT:
          const content = await file.text();
          onFileProcessed(
            {
              text: content,
              words: processText(content),
              fileName: file.name,
              chapters: [],
            },
            file
          );
          break;
      }
    } catch (error) {
      log.error("Error reading file:", error);
      alert(`Error reading ${inputType} file. Please try another file.`);

      // Final fallback for EPUB files
      if (inputType === InputType.EPUB && file) {
        const fallbackText = `This file could not be processed.`;
        const fallbackWords = processText(fallbackText);
        onFileProcessed(
          {
            text: fallbackText,
            words: fallbackWords,
            fileName: file.name,
            chapters: [
              {
                title: "Error",
                startIndex: 0,
                endIndex: fallbackWords.length - 1,
              },
            ],
          },
          file
        );
      }
    }
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (textInput.trim()) {
      onFileProcessed({
        text: textInput,
        words: processText(textInput),
        fileName: "Manual Input",
        chapters: [],
      });
    }
  };

  if (inputType === InputType.TEXT) {
    return (
      <form onSubmit={handleTextSubmit} className="text-input-form">
        <textarea
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Enter or paste your text here..."
          className="text-input-area"
        />
        <div className="text-input-controls">
          <button type="submit" className="btn btn-primary">
            Start Reading
          </button>
          <p className="text-input-or">or</p>
          <div className="file-control">
            <input
              type="file"
              accept=".txt"
              onChange={handleFileUpload}
              className="file-input"
            />
          </div>
        </div>
      </form>
    );
  }

  return (
    <div className="file-control-wrapper">
      <div className="file-control">
        <input
          type="file"
          accept=".epub"
          onChange={handleFileUpload}
          className="file-input"
        />
        <div className="file-input-label">Choose File</div>
      </div>
    </div>
  );
};

export default FileInput;
