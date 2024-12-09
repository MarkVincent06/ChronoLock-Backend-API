const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const cors = require("cors");
const admin = require("firebase-admin");
const serviceAccount = require("./config/serviceAccountKey.json");
const authRoutes = require("./routes/auth");
const groupRoutes = require("./routes/groups");
const messageRoutes = require("./routes/messages");
const userRoutes = require("./routes/users");
const groupMemberRoutes = require("./routes/group_members");
const { UPLOADS_DIR } = require("./storageConfig");

// Import the database connection
require("./db");

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Routes
app.use("/auth", authRoutes);
app.use("/groups", groupRoutes);
app.use("/messages", messageRoutes);
app.use("/users", userRoutes);
app.use("/group-members", groupMemberRoutes);

app.use("/uploads", express.static(UPLOADS_DIR));

// Start the API
const port = 3000;
app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});
