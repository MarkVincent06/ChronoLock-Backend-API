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

// Delete User Endpoint
router.delete("/deleteUser/:id", async (req, res) => {
  const { id } = req.params;

  try {
    // Fetch the current avatar if there is one, so it can be deleted
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

      // Delete the user from the database
      const deleteUserQuery = "DELETE FROM users WHERE id = ?";
      db.query(deleteUserQuery, [id], (deleteErr, deleteResults) => {
        if (deleteErr) {
          console.error("Error deleting user:", deleteErr);
          return res.status(500).send({ error: "Database error" });
        }

        if (deleteResults.affectedRows === 0) {
          return res.status(404).send({ error: "User not found" });
        }

        // If the user had an avatar, delete the file from the filesystem
        if (oldAvatar) {
          const oldAvatarPath = path.join(
            UPLOADS_DIR,
            path.basename(oldAvatar)
          );
          fs.unlink(oldAvatarPath, (unlinkErr) => {
            if (unlinkErr && unlinkErr.code !== "ENOENT") {
              console.error("Error deleting avatar file:", unlinkErr);
            }
          });
        }

        res.send({ message: "User deleted successfully" });
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Internal server error" });
  }
});

// Forgot Password route to verify the email
router.post("/forgotPassword", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).send({ error: "Email is required." });
  }

  const query = "SELECT * FROM users WHERE email = ?";
  db.query(query, [email], (err, results) => {
    if (err) {
      console.error("Error checking email:", err);
      return res.status(500).send({ error: "Internal server error" });
    }

    if (results.length === 0) {
      return res.status(404).send({ error: "Email not found" });
    }

    // Send email verification logic here, if needed

    res.send({ success: true, message: "Verification successful" });
  });
});

// Reset Password route to update the password
router.put("/resetPassword", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!newPassword) {
    return res.status(400).send({ error: "New password is required" });
  }

  // Hash the new password
  // const hashedPassword = await bcrypt.hash(newPassword, 12);

  const query = "UPDATE users SET password = ? WHERE email = ?";
  db.query(query, [newPassword, email], (err, results) => {
    if (err) {
      console.error("Error updating password:", err);
      return res.status(500).send({ error: "Internal server error" });
    }

    if (results.affectedRows === 0) {
      return res.status(404).send({ error: "Email not found" });
    }

    res.send({ success: true, message: "Password reset successfully" });
  });
});

// Change Password
router.put("/changePassword", async (req, res) => {
  const { userId, currentPassword, newPassword } = req.body;

  if (!userId || !currentPassword || !newPassword) {
    return res.status(400).send({ error: "All fields are required." });
  }

  try {
    // Fetch the user by ID
    const query = "SELECT password FROM users WHERE id = ?";
    db.query(query, [userId], async (err, results) => {
      if (err) {
        console.error("Database error:", err);
        return res.status(500).send({ error: "Internal server error." });
      }

      if (results.length === 0) {
        return res.status(404).send({ error: "User not found." });
      }

      const storedPassword = results[0].password;

      // Verify current password
      // const isMatch = await bcrypt.compare(currentPassword, storedPassword);
      const isMatch = currentPassword === storedPassword; // Temporary string comparison
      if (!isMatch) {
        return res.status(401).send({ error: "Incorrect current password." });
      }

      // Hash the new password
      // const newHashedPassword = await bcrypt.hash(newPassword, 12);
      const newHashedPassword = newPassword; // Temporary, no hashing

      // Update the password in the database
      const updateQuery = "UPDATE users SET password = ? WHERE id = ?";
      db.query(updateQuery, [newHashedPassword, userId], (updateErr) => {
        if (updateErr) {
          console.error("Database error:", updateErr);
          return res.status(500).send({ error: "Failed to update password." });
        }

        res.send({ success: true, message: "Password changed successfully." });
      });
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send({ error: "Internal server error." });
  }
});

module.exports = router;
