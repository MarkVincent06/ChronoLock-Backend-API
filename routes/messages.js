const express = require("express");
const db = require("../db");

const router = express.Router();

// ** Messaging Endpoints **
// -------------------------

// Send a message to a group
router.post("/group/:groupId/newMessage", (req, res) => {
  const { groupId } = req.params;
  const { userId, text } = req.body;

  const query =
    "INSERT INTO messages (group_id, user_id, text, isSystem) VALUES (?, ?, ?, 0)";
  db.query(query, [groupId, userId, text], (err, results) => {
    if (err) {
      console.error("Error inserting message:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send({ success: true, messageId: results.insertId });
  });
});

// Send a SYSTEM message to a group
router.post("/group/:groupId/newSystemMessage", (req, res) => {
  const { groupId } = req.params;
  const { userId, text } = req.body;

  const query =
    "INSERT INTO messages (group_id, user_id, text, isSystem) VALUES (?, ?, ?, 1)";
  db.query(query, [groupId, userId, text], (err, results) => {
    if (err) {
      console.error("Error inserting system message:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send({ success: true, messageId: results.insertId });
  });
});

// Fetch messages from a group
router.get("/group/:groupId/fetchMessages", (req, res) => {
  const { groupId } = req.params;

  const query = `
    SELECT 
    messages.id, 
    messages.group_id, 
    messages.text, 
    messages.created_at, 
    messages.user_id, 
    messages.isSeen, 
    messages.isSystem, 
    users.firstName, 
    users.lastName, 
    users.avatar AS user_avatar
    FROM 
        messages
    JOIN 
        users 
    ON 
        messages.user_id = users.idNumber
    WHERE 
        messages.group_id = ?
    ORDER BY 
        messages.created_at DESC;
  `;

  db.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching messages:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send(results);
  });
});

// Mark the latest message as seen in a group
router.post("/group/:groupId/markMessageAsSeen", (req, res) => {
  const { groupId } = req.params;

  const query = `
    UPDATE messages 
    SET isSeen = 1 
    WHERE id = (SELECT id FROM messages WHERE group_id = ? ORDER BY created_at DESC LIMIT 1)
  `;
  db.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error marking messages as seen:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send({ success: true });
  });
});

module.exports = router;
