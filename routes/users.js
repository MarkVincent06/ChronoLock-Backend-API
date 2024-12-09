const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const router = express.Router();
const bcrypt = require("bcrypt");
const { UPLOADS_DIR } = require("../storageConfig");

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

// ** Users Management Endpoints **

// Update user endpoint
router.put("/updateUser/", upload.single("avatar"), async (req, res) => {
  const { id, firstName, lastName, email, password } = req.body;

  try {
    // Hash password if provided
    // let hashedPassword = null;
    // if (password) {
    //   hashedPassword = await bcrypt.hash(password, 12);
    // }

    // New avatar path
    const newAvatarPath = req.file ? `/uploads/${req.file.filename}` : null;

    // Query to fetch the current avatar
    const getAvatarQuery = "SELECT avatar FROM users WHERE id = ?";
    db.query(getAvatarQuery, [id], (err, results) => {
      if (err) {
        console.error("Error fetching user avatar:", err);
        return res.status(500).send({ error: "Database error" });
      }
      if (results.length === 0) {
        return res.status(404).send({ error: "User not found" });
      }

      const oldAvatar = results[0].avatar;

      // Update the user details
      const updateQuery = `
        UPDATE users
        SET 
          firstName = ?,
          lastName = ?,
          email = ?,
          password = COALESCE(?, password),
          avatar = COALESCE(?, avatar),
          updated_at = NOW() -- Always update this field
        WHERE id = ?
      `;
      db.query(
        updateQuery,
        [firstName, lastName, email, password, newAvatarPath, id],
        (updateErr, updateResults) => {
          if (updateErr) {
            console.error("Error updating user:", updateErr);
            return res.status(500).send({ error: "Database error" });
          }
          if (updateResults.affectedRows === 0) {
            return res.status(404).send({ error: "User not found" });
          }

          // If a new avatar was uploaded, delete the old avatar file
          if (req.file && oldAvatar) {
            const oldAvatarPath = path.join(
              UPLOADS_DIR,
              path.basename(oldAvatar)
            );
            fs.unlink(oldAvatarPath, (unlinkErr) => {
              if (unlinkErr && unlinkErr.code !== "ENOENT") {
                console.error("Error deleting old avatar file:", unlinkErr);
              }
            });
          }

          res.send({ message: "User updated successfully" });
        }
      );
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Internal server error" });
  }
});

module.exports = router;
