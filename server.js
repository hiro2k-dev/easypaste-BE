const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const app = express();
const PORT = 8031;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const store = {}; // format: { "123456": { type: "text", content: "..." } }

app.post("/api/publish", (req, res) => {
  const { code, type, content } = req.body;
  if (!code || !content || !type) return res.status(400).json({ error: "Missing data" });
  store[code] = { type, content };
  res.json({ ok: true });
});

app.get("/api/get/:code", (req, res) => {
  const data = store[req.params.code];
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

app.listen(PORT, () => {
  console.log(`🚀 Backend running at http://localhost:${PORT}`);
});
