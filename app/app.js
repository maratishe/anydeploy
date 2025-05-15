// npm install express
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

// Root endpoint returning "I am here"
app.get("/", (req, res) => {
  res.send("<html><body><h1>I am here</h1></body></html>");
});

app.listen(PORT, () => {
  console.log(`Server running at http://0.0.0.0:${PORT}`);
});