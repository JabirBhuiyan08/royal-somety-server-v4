// server/middleware/authMiddleware.js
import { admin } from '../config/firebase.js';
import User from '../models/User.js';

export const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'টোকেন পাওয়া যায়নি' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = await admin.auth().verifyIdToken(token);
    req.uid = decoded.uid;
    req.email = decoded.email;

    let user = await User.findOne({ uid: decoded.uid });
    
    if (!user) {
      const { phone, name, picture } = decoded;
      const isEnvAdmin = process.env.ADMIN_PHONE &&
        phone?.replace(/\D/g, '') === process.env.ADMIN_PHONE?.replace(/\D/g, '');
      const count = await User.countDocuments();
      
      user = await User.create({
        uid: decoded.uid,
        name: name || decoded.name || 'সদস্য',
        phone: phone || decoded.phone,
        email: phone ? phone + '@khanbari.somity' : null,
        avatar: picture || decoded.picture || null,
        role: (count === 0 || isEnvAdmin) ? 'admin' : 'member',
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    if (err.code === 'auth/id-token-expired') {
      return res.status(401).json({ message: 'টোকেনের মেয়াদ শেষ হয়েছে, আবার লগইন করুন' });
    }
    res.status(401).json({ message: 'অবৈধ বা মেয়াদোত্তীর্ণ টোকেন' });
  }
};
