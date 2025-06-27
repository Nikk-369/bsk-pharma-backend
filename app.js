const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const adminRoutes = require("./routes/admin");
const usersRoutes = require("./routes/users");
const orderRoutes = require("./routes/order");
const support = require("./routes/support");
// const cities = require("./routes/city");


const fs = require("fs");
const { logger, logFilePath } = require("./utils/logger");

dotenv.config();
connectDB();

const app = express();
app.use(express.json());
app.use(cors());
app.set("trust proxy", true);
app.use('/uploads', express.static('uploads'));




// API routes
app.use("/admin", adminRoutes);
app.use("/user", usersRoutes);
app.use('/api', orderRoutes);
app.use("/", support);
// app.use("/", cities);


// Logs API endpoint
app.get("/api/logs", (req, res) => {
  fs.readFile(logFilePath, "utf8", (err, data) => {
    if (err) {
      logger.error("Failed to read log file", { error: err.message });
      return res.status(500).json({ error: "Unable to read log file" });
    }
    const logs = data
      .split("\n")
      .filter(line => line.trim() !== "") // Exclude empty lines
      .map(line => JSON.parse(line)); // Parse JSON logs
    res.json(logs);
  });
});



module.exports = app;
