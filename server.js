const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const PORT = 8031;

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

const store = {}; // { "123456": { type: 'text' | 'image', content: '...' } }

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post("/api/publish", (req, res) => {
  const { content, type } = req.body;
  const code = generateCode();
  store[code] = { content, type };
  res.json({ code });
});

app.get("/api/get/:code", (req, res) => {
  const data = store[req.params.code];
  if (!data) return res.status(404).json({ error: "Not found" });
  res.json(data);
});

app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));