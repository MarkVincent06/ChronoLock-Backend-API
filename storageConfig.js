const path = require("path");
const fs = require("fs");

// Set up static folder for uploaded images
const UPLOADS_DIR = path.join(__dirname, "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

module.exports = { UPLOADS_DIR };
