import React, { useState, useEffect } from "react";
import {
  checkStorageUsage,
  cleanupStorage,
  isStorageAvailable,
} from "../helpers/wordStorage";
import {
  migrateFromLocalStorage,
  db,
  checkDBStorageUsage,
} from "../helpers/dexieDB";

interface StorageInfoProps {
  showDetailed?: boolean;
}

const StorageInfo: React.FC<StorageInfoProps> = ({ showDetailed = false }) => {
  const [expanded, setExpanded] = useState(showDetailed);
  const [storageInfo, setStorageInfo] = useState({
    used: 0,
    total: 0,
    usedPercent: 0,
    localStorageItems: 0,
    bookCount: 0,
    chunkCount: 0,
    migratedToIndexedDB: false,
  });
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [migrationInProgress, setMigrationInProgress] = useState(false);

  // Function to update storage info
  const updateStorageInfo = async () => {
    try {
      // Get general storage usage
      const usage = await checkStorageUsage();

      // Get IndexedDB specific usage
      const dbUsage = await checkDBStorageUsage();

      // Check if migration has already been done
      const hasBeenMigrated =
        localStorage.getItem("speedReaderMigrated") === "true";

      // Count localStorage items
      let localStorageItems = 0;
      if (isStorageAvailable()) {
        localStorageItems = localStorage.length;
      }

      setStorageInfo({
        ...usage,
        localStorageItems,
        bookCount: dbUsage.bookCount,
        chunkCount: dbUsage.chunkCount,
        migratedToIndexedDB: hasBeenMigrated,
      });
    } catch (error) {
      console.error("Error updating storage info:", error);
    }
  };

  // Update storage info on mount and periodically if component is visible
  useEffect(() => {
    // Initial update
    updateStorageInfo();

    // Set up interval for updates if component is visible
    const intervalId = setInterval(() => {
      if (document.visibilityState === "visible") {
        updateStorageInfo();
      }
    }, 5000); // Update every 5 seconds

    return () => clearInterval(intervalId);
  }, []);

  // Handler for cleanup
  const handleCleanup = async () => {
    const cleaned = await cleanupStorage();

    if (cleaned) {
      alert("Storage cleanup completed. Orphaned data has been removed.");
      updateStorageInfo();
    } else {
      alert("Storage cleanup failed. Please try again later.");
    }
  };

  // Handler for migration
  const handleMigrate = async () => {
    setMigrationInProgress(true);
    setMigrationStatus("Migration in progress...");

    try {
      const migrated = await migrateFromLocalStorage();

      if (migrated) {
        setMigrationStatus("Migration completed successfully!");
        updateStorageInfo();
      } else {
        setMigrationStatus("Migration failed. Please try again.");
      }
    } catch (error) {
      console.error("Error during migration:", error);
      setMigrationStatus(
        "Error during migration. Please check console for details."
      );
    } finally {
      setMigrationInProgress(false);
    }
  };

  // Format bytes to human-readable format
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Check if storage is getting full
  const isStorageLow = storageInfo.usedPercent > 80;

  return (
    <div className="storage-info">
      <div
        className="storage-info-header"
        onClick={() => setExpanded(!expanded)}
      >
        <h3>Storage Info</h3>
        <span>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded ? (
        <div className="storage-info-details">
          {/* Migration status */}
          {migrationStatus && (
            <div className="storage-info-status">{migrationStatus}</div>
          )}

          {/* Storage sections */}
          <div className="storage-section">
            <h4>localStorage Usage</h4>
            <div className="storage-usage-bar">
              <div
                className="storage-usage-fill"
                style={{ width: `${storageInfo.usedPercent}%` }}
              ></div>
            </div>
            <p>
              {formatBytes(storageInfo.used)} of{" "}
              {formatBytes(storageInfo.total)} used ({storageInfo.usedPercent}%)
            </p>
            <p>Items in localStorage: {storageInfo.localStorageItems}</p>
            {isStorageLow && (
              <p className="storage-warning">
                Storage is getting full! Consider cleaning up or migrating to
                IndexedDB.
              </p>
            )}
          </div>

          <div className="storage-section">
            <h4>IndexedDB Usage</h4>
            <p>Books in library: {storageInfo.bookCount}</p>
            <p>Content chunks: {storageInfo.chunkCount}</p>
            <p
              className={
                storageInfo.migratedToIndexedDB ? "" : "storage-warning"
              }
            >
              Migration status:{" "}
              {storageInfo.migratedToIndexedDB ? "Completed" : "Not completed"}
            </p>
          </div>

          {/* Action buttons */}
          <div className="storage-actions">
            <button className="storage-cleanup-btn" onClick={handleCleanup}>
              Clean Orphaned Data
            </button>

            {!storageInfo.migratedToIndexedDB && (
              <button
                className="storage-migrate-btn"
                onClick={handleMigrate}
                disabled={migrationInProgress}
              >
                {migrationInProgress ? "Migrating..." : "Migrate to IndexedDB"}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="storage-info-simple">
          <div className="storage-usage-bar">
            <div
              className="storage-usage-fill"
              style={{ width: `${storageInfo.usedPercent}%` }}
            ></div>
          </div>
          <p>
            Storage: {storageInfo.usedPercent}% used
            {isStorageLow && (
              <span className="storage-warning"> (Low space!)</span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default StorageInfo;
