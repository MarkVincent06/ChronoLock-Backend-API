const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const db = require("../db");
const router = express.Router();
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

// ** Group Management Endpoints **
// --------------------------------

// Create a new group
router.post("/insertGroup", upload.single("avatar"), (req, res) => {
  const { userIdNumber, name, groupKey } = req.body;
  const avatarPath = req.file ? `/uploads/${req.file.filename}` : null;

  if (!name || !groupKey || !userIdNumber) {
    return res.status(400).send({ error: "Missing required fields" });
  }

  db.beginTransaction((err) => {
    if (err) {
      console.error("Transaction error:", err);
      return res.status(500).send({ error: "Transaction error" });
    }

    // Insert into groups table
    const insertGroupQuery =
      "INSERT INTO groups (group_name, group_key, avatar) VALUES (?, ?, ?)";
    db.query(
      insertGroupQuery,
      [name, groupKey, avatarPath],
      (err, groupResult) => {
        if (err) {
          console.error("Error creating group:", err);
          return db.rollback(() => {
            res.status(500).send({ error: "Database error" });
          });
        }

        const groupId = groupResult.insertId;

        // Insert userIdNumber into group_members table
        const insertMemberQuery =
          "INSERT INTO group_members (idNumber, group_id) VALUES (?, ?)";
        db.query(
          insertMemberQuery,
          [userIdNumber, groupId],
          (err, memberResult) => {
            if (err) {
              console.error("Error adding member to group:", err);
              return db.rollback(() => {
                res.status(500).send({ error: "Database error" });
              });
            }

            db.commit((err) => {
              if (err) {
                console.error("Commit error:", err);
                return db.rollback(() => {
                  res.status(500).send({ error: "Transaction commit error" });
                });
              }

              res.send({ success: true, groupId });
            });
          }
        );
      }
    );
  });
});

// Update group details
router.put("/updateGroup/:id", upload.single("avatar"), (req, res) => {
  const groupId = req.params.id;
  const { name, groupKey } = req.body;
  let avatarPath = null;

  if (req.file) {
    avatarPath = `/uploads/${req.file.filename}`;
  }

  // Query to fetch the current avatar for the group
  const getAvatarQuery = "SELECT avatar FROM groups WHERE group_id = ?";
  db.query(getAvatarQuery, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group avatar:", err);
      return res.status(500).send("Failed to fetch group details.");
    }
    if (results.length === 0) {
      return res.status(404).send({ error: "Group not found." });
    }

    const oldAvatar = results[0].avatar;

    // Update the group details
    const updateGroupQuery = `
      UPDATE groups
      SET group_name = ?, group_key = ?, avatar = COALESCE(?, avatar)
      WHERE group_id = ?
    `;
    db.query(
      updateGroupQuery,
      [name, groupKey, avatarPath, groupId],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.error("Error updating group:", updateErr);
          return res.status(500).send("Failed to update group.");
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

        res.send("Group updated successfully.");
      }
    );
  });
});

// Fetch filtered groups with the latest message (if any)
router.get("/fetchFilteredGroups/:idNumber", (req, res) => {
  const idNumber = req.params.idNumber;
  const query = `
    SELECT 
      g.avatar,
      g.group_id, 
      g.group_name, 
      g.group_key,
      m.text AS latest_message, 
      m.created_at AS message_time, 
      m.isSeen AS latest_message_isSeen, 
      users.firstName AS sender
    FROM groups g
    LEFT JOIN (
      SELECT 
        m.group_id, m.text, m.created_at, m.user_id, m.isSeen
      FROM messages m
      INNER JOIN (
        SELECT group_id, MAX(created_at) AS latest_created_at
        FROM messages
        GROUP BY group_id
      ) subquery ON m.group_id = subquery.group_id 
      AND m.created_at = subquery.latest_created_at
    ) m ON g.group_id = m.group_id
    LEFT JOIN users ON m.user_id = users.idNumber
    LEFT JOIN group_members gm ON gm.group_id= g.group_id
    WHERE gm.idNumber = ?
    ORDER BY message_time DESC
  `;
  db.query(query, [idNumber], (err, results) => {
    if (err) {
      console.error("Error fetching groups:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send(results);
  });
});

// Fetch all groups with the latest message (if any)
router.get("/fetchAllgroups", (req, res) => {
  const query = `
    SELECT 
      g.avatar,
      g.group_id, 
      g.group_name, 
      g.group_key,
      m.text AS latest_message, 
      m.created_at AS message_time, 
      m.isSeen AS latest_message_isSeen, 
      users.firstName AS sender
    FROM groups g
    LEFT JOIN (
      SELECT 
        m.group_id, m.text, m.created_at, m.user_id, m.isSeen
      FROM messages m
      INNER JOIN (
        SELECT group_id, MAX(created_at) AS latest_created_at
        FROM messages
        GROUP BY group_id
      ) subquery ON m.group_id = subquery.group_id 
      AND m.created_at = subquery.latest_created_at
    ) m ON g.group_id = m.group_id
    LEFT JOIN users ON m.user_id = users.idNumber
    ORDER BY message_time DESC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching groups:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send(results);
  });
});

// Fetch available groups with the latest message (if any), excluding groups the user is already in
router.get("/fetchAvailableGroups/:idNumber", (req, res) => {
  const idNumber = req.params.idNumber;

  const query = `
    SELECT 
      g.avatar,
      g.group_id, 
      g.group_name, 
      g.group_key,
      m.text AS latest_message, 
      m.created_at AS message_time, 
      m.isSeen AS latest_message_isSeen, 
      users.firstName AS sender
    FROM groups g
    LEFT JOIN (
      SELECT 
        m.group_id, m.text, m.created_at, m.user_id, m.isSeen
      FROM messages m
      INNER JOIN (
        SELECT group_id, MAX(created_at) AS latest_created_at
        FROM messages
        GROUP BY group_id
      ) subquery ON m.group_id = subquery.group_id 
      AND m.created_at = subquery.latest_created_at
    ) m ON g.group_id = m.group_id
    LEFT JOIN users ON m.user_id = users.idNumber
    WHERE g.group_id NOT IN (
      SELECT group_id 
      FROM group_members 
      WHERE idNumber = ?
    )
    ORDER BY message_time DESC
  `;

  db.query(query, [idNumber], (err, results) => {
    if (err) {
      console.error("Error fetching available groups:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send(results);
  });
});

// Delete Group
router.delete("/deleteGroup/:id", (req, res) => {
  const groupId = req.params.id;

  // Query to check if the group exists and retrieve its avatar path
  const checkGroupQuery = "SELECT avatar FROM groups WHERE group_id = ?";
  db.query(checkGroupQuery, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching group data:", err);
      return res.status(500).send({ error: "Database error" });
    }
    if (results.length === 0) {
      return res.status(404).send({ error: "Group not found." });
    }

    const avatarPath = results[0].avatar;
    const filePath = avatarPath ? path.join(__dirname, avatarPath) : null;

    // Proceed to delete the group record
    const deleteGroupQuery = "DELETE FROM groups WHERE group_id = ?";
    db.query(deleteGroupQuery, [groupId], (deleteErr, deleteResults) => {
      if (deleteErr) {
        console.error("Error deleting group:", deleteErr);
        return res.status(500).send({ error: "Database error" });
      }
      if (deleteResults.affectedRows === 0) {
        return res.status(404).send({ error: "Group not found." });
      }

      // If avatar exists, remove the file from the uploads folder
      if (filePath) {
        fs.unlink(filePath, (unlinkErr) => {
          if (unlinkErr && unlinkErr.code !== "ENOENT") {
            // Log the error only if it’s not a "file not found" error
            console.error("Error deleting avatar file:", unlinkErr);
            return res
              .status(500)
              .send({ error: "Error deleting avatar file" });
          }
          res.send({
            success: true,
            message: "Group and its avatar deleted successfully.",
          });
        });
      } else {
        res.send({
          success: true,
          message: "Group deleted successfully, no avatar to remove.",
        });
      }
    });
  });
});

module.exports = router;
