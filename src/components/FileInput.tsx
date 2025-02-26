import React, { useState } from "react";
import { extractEpubContent } from "../helpers/epubHandler";
import { processText } from "../helpers/textProcessor";
import { FileInputProps, InputType } from "../types/reader";
import JSZip from "jszip";

const FileInput: React.FC<FileInputProps> = ({
  inputType,
  onFileProcessed,
}) => {
  const [textInput, setTextInput] = useState("");

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
            console.log(
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
            console.error("Error extracting EPUB content:", epubError);

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
      console.error("Error reading file:", error);
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
      </div>
    </div>
  );
};

export default FileInput;
