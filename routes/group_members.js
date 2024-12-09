const express = require("express");
const db = require("../db");
const router = express.Router();
const bcrypt = require("bcrypt");

// ** Group Members Management Endpoints **

// fetch total member count endpoint
router.get("/fetchMemberCount/", (req, res) => {
  const { groupId } = req.query;
  const query = `
    SELECT COUNT(*) AS totalCount FROM group_members WHERE group_members.group_id = ?
  `;
  db.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching member count:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send({ success: true, count: results[0].totalCount });
  });
});

// fetch all members in a group endpoint
router.get("/fetchMembers/", (req, res) => {
  const { groupId } = req.query;
  const query = `
      SELECT group_members.id, groups.group_id, users.idNumber, users.firstName, users.lastName, users.avatar, users.userType 
      FROM group_members
      JOIN groups ON groups.group_id = group_members.group_id
      JOIN users ON users.idNumber = group_members.idNumber
      WHERE groups.group_id = ?
  `;
  db.query(query, [groupId], (err, results) => {
    if (err) {
      console.error("Error fetching members:", err);
      return res.status(500).send({ error: "Database error" });
    }
    res.send({ success: true, results });
  });
});

// Insert member by group key endpoint
router.post("/insertMemberByGroupKey", (req, res) => {
  const { userIdNumber, groupKey } = req.body;

  const groupQuery = `SELECT group_id FROM groups WHERE group_key = ?`;
  db.query(groupQuery, [groupKey], (err, groupResults) => {
    if (err) {
      console.error("Error fetching group:", err);
      return res.status(500).send({ error: "Database error" });
    }

    if (groupResults.length === 0) {
      return res.status(400).send({ error: "Invalid group key" });
    }

    const groupId = groupResults[0].group_id;

    // Check if the user is already a member of the group
    const checkMemberQuery = `SELECT * FROM group_members WHERE idNumber = ? AND group_id = ?`;
    db.query(
      checkMemberQuery,
      [userIdNumber, groupId],
      (err, memberResults) => {
        if (err) {
          console.error("Error checking member:", err);
          return res.status(500).send({ error: "Database error" });
        }

        if (memberResults.length > 0) {
          return res
            .status(400)
            .send({ error: "User is already a member of this group" });
        }

        const insertMemberQuery = `INSERT INTO group_members (idNumber, group_id) VALUES (?, ?)`;
        db.query(
          insertMemberQuery,
          [userIdNumber, groupId],
          (err, memberInsertResults) => {
            if (err) {
              console.error("Error inserting member:", err);
              return res.status(500).send({ error: "Database error" });
            }

            res.send({
              success: true,
              message: "Member added to the group successfully",
            });
          }
        );
      }
    );
  });
});

// Delete member in a group endpoint
router.delete("/deleteMember", (req, res) => {
  const { groupId, memberId } = req.body;
  const query = "DELETE FROM group_members WHERE group_id = ? AND idNumber = ?";
  db.query(query, [groupId, memberId], (err, result) => {
    if (err) {
      console.error("Error removing member:", err);
      return res.status(500).send({ error: "Database error" });
    }
    if (result.affectedRows === 0) {
      return res.status(404).send({ error: "Member not found." });
    }
    res.send({ success: true, message: "Member removed successfully." });
  });
});

module.exports = router;
