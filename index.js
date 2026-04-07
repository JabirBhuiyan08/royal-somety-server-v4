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
  // All localhost variations
  'http://localhost:5173',
  'http://localhost:3000',
  // Firebase hosting - both spelling variants
  'https://khanbari-somity.web.app',
  'https://khanbari-somety.web.app',
  'https://khanbari-somity.firebaseapp.com',
  'https://khanbari-somety.firebaseapp.com',
  process.env.CLIENT_URL || 'https://khanbari-somety.web.app',
  // Any vercel.app domain (catch-all)
  'https://khanbari-somity.web.app',
  // Vercel deployments
  'https://royal-somety-server-v4.vercel.app',
  'https://khanbari-server-v4.vercel.app',
  // Additional Vercel client deployments
  'https://royal-somety-client-v4-2.vercel.app',
];

// CORS check function
const isOriginAllowed = (origin) => {
  // Allow requests with no origin (like mobile apps, curl, or server-to-server)
  if (!origin) return true;
  // Allow any vercel.app domain
  if (origin.endsWith('.vercel.app')) return true;
  return allowedOrigins.some(allowed => {
    // Handle wildcard ending
    if (allowed.endsWith('*')) {
      return origin.startsWith(allowed.slice(0, -1));
    }
    return origin === allowed;
  });
};

// Simple CORS - allow all origins for this public API
app.use(cors({
  origin: true, // Allow all origins
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

// ── Debug: Check Firebase Admin status ─────────────────────────────────
import { admin } from './config/firebase.js';

app.get('/api/debug/firebase', (req, res) => {
  res.json({
    firebaseInitialized: !!admin?.apps?.length,
    hasProjectId: !!process.env.FIREBASE_PROJECT_ID,
    hasClientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
    hasPrivateKey: !!process.env.FIREBASE_PRIVATE_KEY,
    projectId: process.env.FIREBASE_PROJECT_ID,
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
  console.log(`📥 ${req.method} ${req.url} | Origin: ${req.headers.origin}`);
  
  // Get origin from request
  const origin = req.headers.origin;
  
  // Handle CORS preflight - do this FIRST before anything else
  if (req.method === 'OPTIONS') {
    // Always allow preflight - use wildcard for maximum compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }
  
  // Add CORS headers to ALL responses (non-OPTIONS requests)
  // Use wildcard to ensure header is always present
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  
  // Let Express handle the request
  return new Promise((resolve) => {
    app(req, res, (err) => {
      if (err) {
        console.error('❌ Express error:', err);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Server error' });
        }
      }
      resolve();
    });
  });
}