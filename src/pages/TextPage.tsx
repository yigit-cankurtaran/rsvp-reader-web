import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navigation from "../components/Navigation";
import "../styles/TextPage.css";
import { processText } from "../helpers/textProcessor";
import FileInput from "../components/FileInput";
import { InputType } from "../types/reader";
import SpeedReader from "../SpeedReader";

const TextPage: React.FC = () => {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [processedWords, setProcessedWords] = useState<string[]>([]);
  const [showReader, setShowReader] = useState(false);

  // Navigation handlers
  const handleGoToLibrary = () => {
    navigate("/library");
  };

  // Process text and show reader directly on this page
  const handleStartReading = () => {
    if (text.trim().length === 0) {
      alert("Please enter some text before starting to read.");
      return;
    }

    // Process the text
    const words = processText(text);
    setProcessedWords(words);
    setShowReader(true);

    // Save text content temporarily (still useful for persistence)
    localStorage.setItem("speedReaderText", text);
    localStorage.setItem("speedReaderWords", JSON.stringify(words));
    localStorage.setItem("speedReaderFileName", "Text Input");
  };

  return (
    <div className="page-container">
      <Navigation />
      <div className="text-page">
        {!showReader ? (
          <div className="text-input-container">
            <h2>Text Input</h2>
            <p className="text-description">
              Enter or paste your text below to start speed reading
            </p>

            <div className="text-editor">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter or paste your text here..."
                rows={10}
              ></textarea>

              <button
                className="start-reading-btn"
                onClick={handleStartReading}
              >
                Start Reading
              </button>
            </div>

            <div className="separator">or</div>

            <div className="file-upload-section">
              <h3>Upload a Text File</h3>
              <FileInput
                inputType={InputType.TEXT}
                onFileProcessed={(result) => {
                  // Save the processed file data
                  localStorage.setItem("speedReaderText", result.text);
                  localStorage.setItem(
                    "speedReaderWords",
                    JSON.stringify(result.words)
                  );
                  localStorage.setItem("speedReaderFileName", result.fileName);

                  // Show reader directly on this page
                  setText(result.text);
                  setProcessedWords(result.words);
                  setShowReader(true);
                }}
              />
            </div>
          </div>
        ) : (
          <div className="embedded-reader-container">
            <div className="reader-controls">
              <button
                className="back-to-input-btn"
                onClick={() => setShowReader(false)}
              >
                Back to Text Input
              </button>
            </div>
            <div className="embedded-reader">
              <SpeedReader
                viewMode="reader"
                onNavigateToLibrary={handleGoToLibrary}
                initialText={text}
                initialWords={processedWords}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextPage;
