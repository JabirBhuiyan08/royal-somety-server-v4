// server/middleware/authMiddleware.js
import { admin } from '../config/firebase.js';
import User from '../models/User.js';

// Token cache to reduce DB queries (5 minute TTL)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCacheKey = (uid) => `user:${uid}`;
const getCachedUser = (uid) => {
  const cached = userCache.get(getCacheKey(uid));
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.user;
  }
  userCache.delete(getCacheKey(uid));
  return null;
};
const setCachedUser = (uid, user) => {
  userCache.set(getCacheKey(uid), { user, timestamp: Date.now() });
};

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log('[AuthMiddleware] Headers:', JSON.stringify(req.headers));
    console.log('[AuthMiddleware] Auth header:', authHeader);
    
    if (!authHeader?.startsWith('Bearer ')) {
      console.log('[AuthMiddleware] No token found');
      return res.status(401).json({ 
        message: 'টোকেন পাওয়া যায়নি',
        code: 'NO_TOKEN',
        shouldRefresh: false
      });
    }

    const token = authHeader.split(' ')[1];
    console.log('[AuthMiddleware] Token (first 50 chars):', token.substring(0, 50));
    
    // Verify and decode token
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token, true); // true = check revocation
      console.log('[AuthMiddleware] Token verified, uid:', decoded.uid);
    } catch (verifyErr) {
      console.log('[AuthMiddleware] Token verification error:', verifyErr.code, verifyErr.message);
      console.log('[AuthMiddleware] Full error:', JSON.stringify(verifyErr));
      // Handle specific Firebase auth errors
      if (verifyErr.code === 'auth/id-token-expired') {
        return res.status(401).json({ 
          message: 'টোকেনের মেয়াদ শেষ হয়েছে, আবার লগইন করুন',
          code: 'TOKEN_EXPIRED',
          shouldRefresh: true
        });
      }
      if (verifyErr.code === 'auth/id-token-revoked') {
        return res.status(401).json({ 
          message: 'টোকেন বাতিল করা হয়েছে, আবার লগইন করুন',
          code: 'TOKEN_REVOKED',
          shouldRefresh: true
        });
      }
      // Return more specific error message
      return res.status(401).json({ 
        message: 'টোকেন যাচাই ব্যর্থ: ' + verifyErr.message,
        code: verifyErr.code || 'INVALID_TOKEN',
        shouldRefresh: false
      });
    }

    req.uid = decoded.uid;
    req.email = decoded.email;

// Try cache first
    let user = getCachedUser(decoded.uid);
    
    if (!user) {
      user = await User.findOne({ uid: decoded.uid });
      
      if (user) {
        // Cache the user
        setCachedUser(decoded.uid, user);
      }
      // Don't create user here - let register endpoint handle creation
    }
    
    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        message: 'টোকেনের মেয়াদ শেষ হয়েছে, আবার লগইন করুন',
        code: 'TOKEN_EXPIRED',
        shouldRefresh: true
      });
    }
    
    res.status(401).json({ 
      message: 'অবৈধ বা মেয়াদোত্তীর্ণ টোকেন',
      code: 'INVALID_TOKEN',
      shouldRefresh: false
    });
  }
};

// Export function to clear user cache (call when user data changes)
export const clearUserCache = (uid) => {
  userCache.delete(getCacheKey(uid));
};
