// cron-loop.js
const fs = require("fs");
const path = require("path");

const UPLOAD_DIR = path.join(__dirname, "uploads");
const STORE_FILE = path.join(__dirname, "store.json");
const FILESTORE_FILE = path.join(__dirname, "fileStore.json");

const EXPIRATION_MS = 10 * 60 * 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadJSON(filePath) {
  if (!fs.existsSync(filePath)) return {};
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return {};
  }
}

function saveJSON(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

async function cleanupLoop() {
  console.log("[CRON] Cleanup loop started.");

  while (true) {
    try {
      const now = Date.now();

      let store = loadJSON(STORE_FILE);
      let fileStore = loadJSON(FILESTORE_FILE);

      let removed = 0;

      for (const code in store) {
        const last = store[code].lastUpdated || 0;
        if (now - last > EXPIRATION_MS) {
          delete store[code];
          removed++;
        }
      }

      for (const code in fileStore) {
        const meta = fileStore[code];
        const last = meta.lastUpdated || 0;

        if (now - last > EXPIRATION_MS) {
          const filePath = path.resolve(meta.path || "");

          if (filePath.startsWith(UPLOAD_DIR) && fs.existsSync(filePath)) {
            try {
              fs.unlinkSync(filePath);
            } catch (err) {
              console.error("[CRON] Failed to delete file:", err);
            }
          }

          delete fileStore[code];
          removed++;
        }
      }

      if (removed > 0) {
        console.log(`[CRON] Removed ${removed} expired sessions.`);
      }

      saveJSON(STORE_FILE, store);
      saveJSON(FILESTORE_FILE, fileStore);
    } catch (err) {
      console.error("[CRON] Error in loop:", err);
    }

    await sleep(2000);
  }
}

cleanupLoop();
