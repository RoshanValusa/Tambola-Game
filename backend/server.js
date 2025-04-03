const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors()); // Allow frontend requests

app.get("/", (req, res) => {
  res.json({ message: "Backend is running!" });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));