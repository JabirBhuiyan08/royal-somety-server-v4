// server/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import { connectDB } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import memberRoutes from './routes/memberRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

// initialise Firebase Admin early
import './config/firebase.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Connect DB
connectDB().catch(err => {
  console.error('❌ Database connection failed:', err.message);
});

// ── Startup diagnostics ──────────────────────────────────────────────────────
console.log('🚀 Server initializing...');
console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
console.log(`   VERCEL: ${process.env.VERCEL || 'not set'}`);

// ── Security & Parsing ───────────────────────────────────────────────

// Define allowed origins - accept all variations
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://khanbari-somity.web.app',
  'https://khanbari-somety.web.app',
  'https://khanbari-somity.firebaseapp.com',
  'https://khanbari-somety.firebaseapp.com',
  process.env.CLIENT_URL,
  // All possible Vercel deployment domains (exact and wildcard)
  'https://royal-somety-server-v4.vercel.app',
  'https://royal-somety-server-v4-git-main-jabir-bhuiyans-projects.vercel.app',
  'https://royal-somety-server-v4-r0fefentx-jabir-bhuiyans-projects.vercel.app',
  'https://royal-somety-server-v4-git-*.vercel.app',
  'https://khanbari-somity.web.app',
  'https://khanbari-somity.firebaseapp.com',
  'https://khanbari-somity*.firebaseapp.com',
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check exact match or wildcard match
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed.endsWith('*')) {
        return origin.startsWith(allowed.slice(0, -1));
      }
      return origin === allowed;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log(`❌ CORS rejected origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Trust proxy (needed for rate-limiting behind Render/Railway)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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

// ── Request logging (diagnostics) ────────────────────────────────────
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  next();
});

// ── Routes ───────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/member', memberRoutes);
app.use('/api/admin', adminRoutes);

// ── Health check ─────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'খানবাড়ি সার্ভার চলছে ✅',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()) + 's',
  });
});

// ── 404 ──────────────────────────────────────────────────────────────
app.use('*', (req, res) => {
  console.log(`❌ 404: ${req.method} ${req.originalUrl}`);
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

// ── Start server (local only) ─────────────────────────────────────────
const isVercel = process.env.VERCEL === '1';

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`\n🏠 খানবাড়ি সার্ভার চলছে`);
    console.log(`   → http://localhost:${PORT}`);
    console.log(`   → Health: http://localhost:${PORT}/api/health\n`);
  });
}

// ── Vercel serverless handler ────────────────────────────────────────────
export default async function handler(req, res) {
  try {
    console.log(`📥 ${req.method} ${req.url}`);
    
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.some(o => 
        o === origin || (o.endsWith('*') && origin.startsWith(o.slice(0, -1)))
      )) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
      }
      res.status(204).end();
      return;
    }
    
    // Forward to Express
    app(req, res);
  } catch (err) {
    console.error('❌ Handler error:', err);
    res.status(500).json({ message: 'Internal server error' });
  }
}