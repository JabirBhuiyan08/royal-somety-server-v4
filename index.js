// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// initialise Firebase Admin early
import './config/firebase.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Connect DB
connectDB();

// ── Security & Parsing ───────────────────────────────────────────────
// server/index.js

// Define allowed origins
const allowedOrigins = [
  'http://localhost:5173',
  'https://khanbari-somety-client.vercel.app',
  process.env.CLIENT_URL // This covers whatever you set in your .env
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));


app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Trust proxy (needed for rate-limiting behind Render/Railway)
app.set('trust proxy', 1);

// ── Rate limiting ────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 150,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'অনেক বেশি অনুরোধ, ১৫ মিনিট পরে চেষ্টা করুন' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // Stricter for auth endpoints
  message: { message: 'লগইন চেষ্টা সীমা অতিক্রান্ত' },
});

app.use('/api', limiter);
app.use('/api/auth', authLimiter);

// ── Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'খানবাড়ি ভাই ভাই সার্ভার চলছে ✅',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// ── 404 ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({ message: `রুট পাওয়া যায়নি: ${req.originalUrl}` });
});

// ── Global error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Server error:', err.stack);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({ message: messages.join(', ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(409).json({ message: `${field} ইতিমধ্যে ব্যবহৃত হয়েছে` });
  }

  // Multer file size error
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ message: 'ফাইলের আকার অনেক বড়' });
  }

  res.status(err.status || 500).json({
    message: err.message || 'সার্ভার সমস্যা হয়েছে',
  });
});

app.listen(PORT, () => {
  console.log(`\n🏠 খানবাড়ি ভাই ভাই সার্ভার চলছে`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → Health: http://localhost:${PORT}/api/health\n`);
});
