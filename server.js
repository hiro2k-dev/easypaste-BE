const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8031;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const UPLOAD_DIR = path.join(__dirname, "uploads");
const STORE_FILE = path.join(__dirname, "store.json");
const FILESTORE_FILE = path.join(__dirname, "fileStore.json");

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
});

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

function generateSessionCode() {
  const letters = Array.from({ length: 2 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join("");

  const digitLength = 4 + Math.floor(Math.random() * 3);
  let digits = "";
  for (let i = 0; i < digitLength; i++) {
    digits += Math.floor(Math.random() * 10).toString();
  }

  return `${letters}${digits}`;
}

app.post("/api/session", (req, res) => {
  let store = loadJSON(STORE_FILE);
  let fileStore = loadJSON(FILESTORE_FILE);

  let code;
  do {
    code = generateSessionCode();
  } while (store[code] || fileStore[code]);

  const now = Date.now();
  store[code] = { type: "text", content: "", lastUpdated: now };

  saveJSON(STORE_FILE, store);

  res.json({ code });
});

app.post("/api/publish", (req, res) => {
  const { code, type, content } = req.body;
  if (!code || !content || !type) {
    return res.status(400).json({ error: "Missing data" });
  }
  if (type !== "text") {
    return res
      .status(400)
      .json({ error: "Only type 'text' is supported for this endpoint" });
  }

  let store = loadJSON(STORE_FILE);
  const now = Date.now();

  store[code] = { type, content, lastUpdated: now };

  saveJSON(STORE_FILE, store);

  res.json({ ok: true });
});

app.get("/api/get/:code", (req, res) => {
  const store = loadJSON(STORE_FILE);
  const data = store[req.params.code];
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

app.post("/api/file/upload", upload.single("file"), (req, res) => {
  const { code } = req.body;
  const file = req.file;

  if (!code) {
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ error: "Missing code" });
  }

  if (!file) {
    return res.status(400).json({ error: "Missing file" });
  }

  let fileStore = loadJSON(FILESTORE_FILE);
  const now = Date.now();

  fileStore[code] = {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: now,
    lastUpdated: now,
  };

  saveJSON(FILESTORE_FILE, fileStore);

  res.json({
    ok: true,
    file: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: now,
    },
  });
});

app.get("/api/file/meta/:code", (req, res) => {
  const fileStore = loadJSON(FILESTORE_FILE);
  const data = fileStore[req.params.code];
  if (!data) {
    return res.status(404).json({ error: "Not found" });
  }

  res.json({
    file: {
      originalName: data.originalName,
      mimeType: data.mimeType,
      size: data.size,
      uploadedAt: data.uploadedAt,
    },
  });
});

app.get("/api/file/download/:code", (req, res) => {
  const fileStore = loadJSON(FILESTORE_FILE);
  const data = fileStore[req.params.code];
  if (!data) {
    return res.status(404).json({ error: "Not found" });
  }

  const absolutePath = path.resolve(data.path);
  if (!absolutePath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(410).json({ error: "File no longer exists" });
  }

  res.download(absolutePath, data.originalName);
});

app.delete("/api/session/:code", (req, res) => {
  const code = req.params.code;

  let store = loadJSON(STORE_FILE);
  let fileStore = loadJSON(FILESTORE_FILE);

  let found = false;

  if (store[code]) {
    delete store[code];
    found = true;
  }

  const fileMeta = fileStore[code];
  if (fileMeta) {
    found = true;

    const absolutePath = path.resolve(fileMeta.path || "");
    if (
      absolutePath &&
      absolutePath.startsWith(UPLOAD_DIR) &&
      fs.existsSync(absolutePath)
    ) {
      try {
        fs.unlinkSync(absolutePath);
      } catch (e) {
        console.error("Failed to delete file", e);
      }
    }

    delete fileStore[code];
  }

  if (!found) {
    return res.status(404).json({ error: "Not found" });
  }

  saveJSON(STORE_FILE, store);
  saveJSON(FILESTORE_FILE, fileStore);

  return res.json({ ok: true });
});

app.get("/api/ping", (req, res) => {
  res.json({ pong: true, message: "EasyCopy API is alive" });
});

app.use((err, req, res, next) => {
  if (err && err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Max 10MB." });
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
