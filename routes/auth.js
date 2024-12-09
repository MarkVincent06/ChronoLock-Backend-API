const express = require("express");
const db = require("../db");
const admin = require("firebase-admin");
const bcrypt = require("bcrypt");

const router = express.Router();

// Function to generate Firebase custom token
const generateFirebaseToken = async (userId, email, displayName) => {
  try {
    const token = await admin.auth().createCustomToken(userId, {
      email: email,
      displayName: displayName,
    });
    return token;
  } catch (error) {
    console.error("Error generating Firebase token:", error);
    throw error;
  }
};

// Get user in the MySQL database
const getUser = (email) => {
  return new Promise((resolve, reject) => {
    const query = "SELECT * FROM users WHERE email = ?";
    db.query(query, [email], (err, results) => {
      if (err) {
        return reject(err);
      }
      resolve(results);
    });
  });
};

// ** Authentication Endpoints **
// ------------------------------

// Endpoint for login
// router.post("/login", async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res
//       .status(400)
//       .send({ success: false, message: "Email and password are required." });
//   }

//   try {
//     const results = await getUser(email);

//     if (results.length > 0) {
//       const user = results[0];

//       // Compare provided password with the hashed password in the database
//       const isPasswordValid = await bcrypt.compare(password, user.password);
//       if (isPasswordValid) {
//         // Exclude sensitive data (like the password) from the response
//         const { password, ...userWithoutPassword } = user;
//         return res.send({ success: true, user: userWithoutPassword });
//       } else {
//         return res
//           .status(401)
//           .send({ success: false, message: "Invalid email or password." });
//       }
//     } else {
//       return res.status(404).send({
//         success: false,
//         message: "User not found. Please register first.",
//       });
//     }
//   } catch (err) {
//     console.error("Error checking user in database:", err);
//     res.status(500).send({ success: false, error: "Database error" });
//   }
// });

// Temporary login endpoint without password hashing
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .send({ success: false, message: "Email and password are required." });
  }

  try {
    const results = await getUser(email);

    if (results.length > 0) {
      const user = results[0];

      // Temporarily compare plain text passwords
      if (password === user.password) {
        const displayName =
          user.accountName || `${user.firstName} ${user.lastName}`;

        // Generate Firebase custom token after successful login
        const firebaseToken = await generateFirebaseToken(
          user.idNumber,
          user.email,
          displayName
        );

        // Exclude sensitive data (like the password) from the response
        const { password, ...userWithoutPassword } = user;
        return res.send({
          success: true,
          user: userWithoutPassword,
          firebaseToken: firebaseToken,
        });
      } else {
        return res
          .status(401)
          .send({ success: false, message: "Invalid email or password." });
      }
    } else {
      return res.status(404).send({
        success: false,
        message: "User not found. Please register first.",
      });
    }
  } catch (err) {
    console.error("Error checking user in database:", err);
    res.status(500).send({ success: false, error: "Database error" });
  }
});

// Endpoint for Google Sign-In
router.post("/googleSignIn", async (req, res) => {
  const { email } = req.body;

  try {
    const results = await getUser(email);

    if (results.length > 0) {
      const user = results[0];
      res.send({ exists: true, user });
    } else {
      res.send({
        exists: false,
        message: "User not found. Please register first.",
      });
    }
  } catch (err) {
    console.error("Error checking user in database:", err);
    res.status(500).send({ error: "Database error" });
  }
});

module.exports = router;
