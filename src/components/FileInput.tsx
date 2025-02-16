import React, { useState } from "react";
import { extractEpubContent } from "../helpers/epubHandler";
import { processText } from "../helpers/textProcessor";
import { Chapter, InputType } from "../types/reader";

interface FileInputProps {
  inputType: InputType;
  onFileProcessed: (data: {
    text: string;
    words: string[];
    fileName: string;
    chapters?: Chapter[];
  }) => void;
}

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
          const epubContent = await extractEpubContent(file);
          onFileProcessed({
            text: epubContent.text,
            words: processText(epubContent.text),
            fileName: file.name,
            chapters: epubContent.chapters,
          });
          break;

        case InputType.TEXT:
          const content = await file.text();
          onFileProcessed({
            text: content,
            words: processText(content),
            fileName: file.name,
            chapters: [],
          });
          break;
      }
    } catch (error) {
      console.error("Error reading file:", error);
      alert(`Error reading ${inputType} file. Please make sure it is valid.`);
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
