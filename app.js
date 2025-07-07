// const express = require("express");
// const dotenv = require("dotenv");
// const cors = require("cors");
// const connectDB = require("./config/db");
// const adminRoutes = require("./routes/admin");
// const usersRoutes = require("./routes/users");
// const orderRoutes = require("./routes/order");
// // const support = require("./routes/support");
// // const cities = require("./routes/city");
// // const path = require("path");


// const fs = require("fs");
// const { logger, logFilePath } = require("./utils/logger");

// dotenv.config();
// connectDB();

// const app = express();
// app.use(express.json());
// app.use(cors());
// app.set("trust proxy", true);
// app.use('/uploads', express.static('uploads'));
// // app.use("/uploads", express.static(path.join(__dirname, "uploads")));




// // API routes
// app.use("/admin", adminRoutes);
// app.use("/user", usersRoutes);
// app.use('/api', orderRoutes);
// // app.use("/", support);
// // app.use("/", cities);


// // Logs API endpoint
// app.get("/api/logs", (req, res) => {
//   fs.readFile(logFilePath, "utf8", (err, data) => {
//     if (err) {
//       logger.error("Failed to read log file", { error: err.message });
//       return res.status(500).json({ error: "Unable to read log file" });
//     }
//     const logs = data
//       .split("\n")
//       .filter(line => line.trim() !== "") // Exclude empty lines
//       .map(line => JSON.parse(line)); // Parse JSON logs
//     res.json(logs);
//   });
// });



// module.exports = app;



// updated app.js:
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const adminRoutes = require("./routes/admin");
const usersRoutes = require("./routes/users");
const orderRoutes = require("./routes/order");
const fs = require("fs");
const https = require("https");
const http = require("http");
const { logger, logFilePath } = require("./utils/logger");

// Load environment variables
dotenv.config();

// Database connection
connectDB();

// Express app initialization
const app = express();

// CORS configuration for multiple domains
const allowedOrigins = [
  'http://drbskhealthcare.in',
  'http://31.97.61.81',
  'https://drbskhealthcare.com',
  'http://localhost:3000' // for development
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

// Trust proxy for proper IP and protocol detection
app.set("trust proxy", true);

// Middleware
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// API routes
app.use("/admin", adminRoutes);
app.use("/user", usersRoutes);
app.use('/api', orderRoutes);

// Logs API endpoint
app.get("/api/logs", (req, res) => {
  fs.readFile(logFilePath, "utf8", (err, data) => {
    if (err) {
      logger.error("Failed to read log file", { error: err.message });
      return res.status(500).json({ error: "Unable to read log file" });
    }
    const logs = data
      .split("\n")
      .filter(line => line.trim() !== "")
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (e) {
          logger.error("Failed to parse log line", { line, error: e.message });
          return null;
        }
      })
      .filter(log => log !== null);
    res.json(logs);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Server error', { 
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  
  res.status(500).json({ 
    error: process.env.NODE_ENV === 'development' ? err.message : 'Server error'
  });
});

// Export the app for testing or additional server configuration
module.exports = app;

// Start servers only if this is the main module
if (require.main === module) {
  const port = process.env.PORT || 4000;
  
  // HTTP server for .in and IP access
  http.createServer(app).listen(port, () => {
    logger.info(`HTTP server running on port ${port}`);
  });

  // HTTPS server for .com if SSL certificates are available
  if (process.env.SSL_KEY_PATH && process.env.SSL_CERT_PATH) {
    try {
      const httpsOptions = {
        key: fs.readFileSync(process.env.SSL_KEY_PATH),
        cert: fs.readFileSync(process.env.SSL_CERT_PATH),
        ca: process.env.SSL_CA_PATH ? fs.readFileSync(process.env.SSL_CA_PATH) : null
      };

      const httpsPort = process.env.HTTPS_PORT || 4001;
      https.createServer(httpsOptions, app).listen(httpsPort, () => {
        logger.info(`HTTPS server running on port ${httpsPort}`);
      });
    } catch (err) {
      logger.error('Failed to start HTTPS server', { error: err.message });
    }
  }
}
