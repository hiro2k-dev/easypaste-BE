const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 8031;

app.use(cors());

// JSON body limit 10MB
app.use(bodyParser.json({ limit: "10mb" }));

// ===== File upload config =====

// Upload directory (server operates only inside this directory)
const UPLOAD_DIR = path.join(__dirname, "uploads");

// Create directory if it doesn't exist
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure storage for multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Filename is randomized to avoid collisions and client-provided names
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${unique}${ext}`);
  },
});

// Limit file size 10MB
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// ===== In-memory store =====
// Text store
const store = {}; // { "123456": { type: "text", content: "..." } }

// File store
const fileStore = {}; // { "123456": { originalName, mimeType, size, path, uploadedAt } }

// ===== Routes for text =====

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

  store[code] = { type, content };
  res.json({ ok: true });
});

app.get("/api/get/:code", (req, res) => {
  const data = store[req.params.code];
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

// ===== Routes for file =====

// Upload file: multipart/form-data with fields:
// - code: session code
// - file: file upload
app.post("/api/file/upload", upload.single("file"), (req, res) => {
  const { code } = req.body;
  const file = req.file;

  if (!code) {
    // Delete uploaded file if code is missing
    if (file && file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
    return res.status(400).json({ error: "Missing code" });
  }

  if (!file) {
    return res.status(400).json({ error: "Missing file" });
  }

  fileStore[code] = {
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    path: file.path,
    uploadedAt: Date.now(),
  };

  res.json({
    ok: true,
    file: {
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      uploadedAt: fileStore[code].uploadedAt,
    },
  });
});

app.get("/api/file/meta/:code", (req, res) => {
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
  const data = fileStore[req.params.code];
  if (!data) {
    return res.status(404).json({ error: "Not found" });
  }

  // Ensure file still in UPLOAD_DIR (safe)
  const absolutePath = path.resolve(data.path);
  if (!absolutePath.startsWith(UPLOAD_DIR)) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  if (!fs.existsSync(absolutePath)) {
    return res.status(410).json({ error: "File no longer exists" });
  }

  res.download(absolutePath, data.originalName);
});

// ===== Health check =====
app.get("/api/ping", (req, res) => {
  res.json({ pong: true, message: "EasyCopy API is alive" });
});

// ===== Multer error handler (limit 10MB) =====
app.use((err, req, res, next) => {
  if (err && err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "File too large. Max 10MB." });
  }
  next(err);
});

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
