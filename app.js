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


// app.get('/', (req, res) => {
//   res.send('✅ Dr BSK Healthcare backend is running with HTTPS!');
// });
// module.exports = app;

// 2:
const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const connectDB = require("./config/db");
const adminRoutes = require("./routes/admin");
const usersRoutes = require("./routes/users");
const orderRoutes = require("./routes/order");
const razorpayRoutes = require('./routes/razorpay');
const nodemailer = require('nodemailer');

// In-memory OTP store (for demo; switch to DB or cache in production)
const otpStore = {};

const fs = require("fs");
const { logger, logFilePath } = require("./utils/logger");

dotenv.config();
connectDB();

const app = express();
// app.use(express.json());
app.use(express.json({ limit: '10mb' }))


// const allowedOrigins = [
//   'https://drbskhealthcare.com',
//   'http://localhost:3000',
//   'https://fvvcbrpm-4000.inc1.devtunnels.ms',
// ];

// app.set('trust proxy', true);

// // Apply CORS middleware
// app.use(cors({
//   origin: (origin, cb) => {
//     if (!origin) return cb(null, true);
//     if (allowedOrigins.includes(origin)) {
//       return cb(null, true);
//     } else {
//       return cb(new Error('CORS policy: Origin not allowed'), false);
//     }
//   },
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization'],
//   credentials: true,
// }));

app.use(cors());
app.set("trust proxy", true);
app.use('/uploads', express.static('uploads'));


// API routes
app.use("/admin", adminRoutes);
app.use("/user", usersRoutes);
app.use('/api', orderRoutes);
app.use('/razorpay', razorpayRoutes);


// --- New OTP Email Verification Routes ---

// Setup Nodemailer transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  }
});

// Endpoint to send OTP to email
app.post('/api/send-otp', (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP with 5-minute expiry
  otpStore[email] = { otp, expires: Date.now() + 5 * 60 * 1000 };

  const mailOptions = {
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject: 'Your OTP Code',
    text: `Your OTP code is ${otp}. It will expire in 5 minutes.`,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    // if (error) {
    //   logger.error('Failed to send OTP email', { error: error.message });
    //   return res.status(500).json({ message: 'Failed to send OTP' });
    // }
    if (error) {
      logger.error('Failed to send OTP email', { error: error.message, stack: error.stack });
      return res.status(500).json({ message: error.message });
    }
    logger.info('OTP email sent', { to: email });
    res.json({ message: 'OTP sent successfully' });
  });
});

// Endpoint to verify OTP
app.post('/api/verify-otp', (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) {
    return res.status(400).json({ message: 'Email and OTP are required' });
  }

  const record = otpStore[email];
  if (!record) {
    return res.status(400).json({ message: 'OTP not found or expired, please request again' });
  }

  if (Date.now() > record.expires) {
    delete otpStore[email];
    return res.status(400).json({ message: 'OTP expired, please request again' });
  }

  if (record.otp !== otp) {
    return res.status(400).json({ message: 'Invalid OTP' });
  }

  // Successful verification
  delete otpStore[email];
  res.json({ message: 'OTP verified successfully' });
});



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


app.get('/', (req, res) => {
  res.send('✅ Dr BSK Healthcare backend is running with HTTPS!');
});
module.exports = app;

