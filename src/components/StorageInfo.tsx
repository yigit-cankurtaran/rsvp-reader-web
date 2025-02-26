import React, { useState, useEffect } from "react";
import {
  checkStorageUsage,
  cleanupStorage,
  isStorageAvailable,
} from "../helpers/wordStorage";

interface StorageInfoProps {
  showDetailed?: boolean;
}

const StorageInfo: React.FC<StorageInfoProps> = ({ showDetailed = false }) => {
  const [storageInfo, setStorageInfo] = useState(() => checkStorageUsage());
  const [available, setAvailable] = useState(() => isStorageAvailable());
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    // Update every 5 seconds if visible
    const interval = setInterval(() => {
      setStorageInfo(checkStorageUsage());
      setAvailable(isStorageAvailable());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const handleCleanup = () => {
    const cleaned = cleanupStorage();
    if (cleaned) {
      alert("Storage cleaned successfully!");
      setStorageInfo(checkStorageUsage());
    } else {
      alert("No orphaned data found to clean.");
    }
  };

  if (!showDetailed) {
    // Simple display for non-detailed view
    return (
      <div className="storage-info-simple">
        {!available ? (
          <span className="storage-warning">⚠️ localStorage unavailable</span>
        ) : storageInfo.usedPercent > 90 ? (
          <span className="storage-warning">
            ⚠️ Storage almost full ({storageInfo.usedPercent}%)
          </span>
        ) : storageInfo.usedPercent > 70 ? (
          <span className="storage-warning">
            ⚠️ Storage: {storageInfo.usedPercent}% used
          </span>
        ) : null}
      </div>
    );
  }

  // Detailed view
  return (
    <div className="storage-info">
      <div
        className="storage-info-header"
        onClick={() => setExpanded(!expanded)}
      >
        <h3>Storage Information {expanded ? "▼" : "▶"}</h3>
        {storageInfo.usedPercent > 80 && (
          <span className="storage-warning">⚠️</span>
        )}
      </div>

      {expanded && (
        <div className="storage-info-details">
          <div className="storage-usage-bar">
            <div
              className="storage-usage-fill"
              style={{
                width: `${storageInfo.usedPercent}%`,
                backgroundColor:
                  storageInfo.usedPercent > 90
                    ? "red"
                    : storageInfo.usedPercent > 70
                      ? "orange"
                      : "green",
              }}
            />
          </div>

          <div className="storage-stats">
            <p>
              <strong>Usage:</strong> {(storageInfo.used / 1024).toFixed(1)}KB /{" "}
              {(storageInfo.total / 1024).toFixed(1)}KB (
              {storageInfo.usedPercent}%)
            </p>
            <p>
              <strong>Items:</strong> {storageInfo.items}
            </p>
            <p>
              <strong>Status:</strong>{" "}
              {!available
                ? "Not available"
                : !storageInfo.hasSpace
                  ? "Almost full"
                  : "Available"}
            </p>
          </div>

          <button className="storage-cleanup-btn" onClick={handleCleanup}>
            Clean Orphaned Data
          </button>
        </div>
      )}
    </div>
  );
};

export default StorageInfo;
