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
  acceptFormats,
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
          // Process text files (.txt, .md, etc.)
          try {
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
          } catch (textError) {
            console.error("Error reading text file:", textError);
            alert(
              "There was an error reading the text file. Please try another file."
            );
          }
          break;
      }
    } catch (error) {
      console.error("File upload error:", error);
      alert("There was an error processing the file. Please try again.");
    }
  };

  // Handle text submission from the textarea
  const handleTextSubmit = () => {
    if (textInput.trim().length === 0) return;

    onFileProcessed({
      text: textInput,
      words: processText(textInput),
      fileName: "Text Input",
      chapters: [],
    });

    // Clear the input after processing
    setTextInput("");
  };

  // Determine accept attribute for file input based on input type and acceptFormats
  const getAcceptAttribute = () => {
    if (acceptFormats) {
      return acceptFormats;
    }

    switch (inputType) {
      case InputType.EPUB:
        return ".epub";
      case InputType.TEXT:
        return ".txt,.text,.md";
      default:
        return "";
    }
  };

  return (
    <div className="file-control-wrapper">
      <div className="file-control">
        <label className="file-input-label">
          Choose {inputType === InputType.EPUB ? "EPUB" : "Text"} File
          <input
            type="file"
            onChange={handleFileUpload}
            className="file-input"
            accept={getAcceptAttribute()}
          />
        </label>
      </div>

      {inputType === InputType.TEXT && (
        <div className="text-input-form">
          <textarea
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            className="text-input-area"
            placeholder="Or paste your text here..."
          />
          <button
            onClick={handleTextSubmit}
            disabled={textInput.trim().length === 0}
            className="btn btn-primary"
          >
            Read Text
          </button>
        </div>
      )}
    </div>
  );
};

export default FileInput;
