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

    const user = await User.findOne({ uid: decoded.uid });
    if (!user) return res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });

    req.user = user;
    next();
  } catch (err) {
    console.error('Token verification error:', err.message);
    res.status(401).json({ message: 'অবৈধ বা মেয়াদোত্তীর্ণ টোকেন' });
  }
};
