// server/controllers/authController.js
import User from '../models/User.js';

// Register new user after Firebase signup — saves full data to MongoDB
export const registerUser = async (req, res) => {
  try {
    const { uid, name, email, phone, bloodGroup, photoURL } = req.body;

    const existing = await User.findOne({ uid });
    if (existing) return res.status(200).json({ message: 'সদস্য ইতিমধ্যে আছেন', user: existing });

    // Check if this phone is the designated admin from .env
    const isEnvAdmin = process.env.ADMIN_PHONE &&
      phone?.replace(/\D/g, '') === process.env.ADMIN_PHONE?.replace(/\D/g, '');

    // First user OR env admin phone → admin role
    const count = await User.countDocuments();
    const role = (count === 0 || isEnvAdmin) ? 'admin' : 'member';

    const user = await User.create({
      uid, name, email: phone + '@khanbari.somity', phone, bloodGroup,
      avatar: photoURL || null,
      role,
    });

    res.status(201).json({ message: 'নিবন্ধন সফল', user });
  } catch (err) {
    if (err.code === 11000) {
      // Phone already exists — just return the existing user
      const user = await User.findOne({ phone: req.body.phone });
      return res.status(200).json({ user });
    }
    console.error('Register error:', err);
    res.status(500).json({ message: 'নিবন্ধন ব্যর্থ হয়েছে' });
  }
};

// Get currently authenticated user
export const getMe = async (req, res) => {
  try {
    res.json({ user: req.user });
  } catch (err) {
    res.status(500).json({ message: 'সদস্য তথ্য আনতে ব্যর্থ' });
  }
};

// Phone-based login sync — upsert user in MongoDB
export const syncUser = async (req, res) => {
  try {
    const { uid, name, phone, photoURL } = req.body;

    // Check if this phone is the designated admin from .env
    const isEnvAdmin = process.env.ADMIN_PHONE &&
      phone?.replace(/\D/g, '') === process.env.ADMIN_PHONE?.replace(/\D/g, '');

    let user = await User.findOne({ uid });
    
    if (!user) {
      // New user - create one
      const count = await User.countDocuments();
      user = await User.create({
        uid, 
        name: name || 'সদস্য', 
        phone,
        email: phone ? phone + '@khanbari.somity' : null,
        avatar: photoURL || null,
        role: (count === 0 || isEnvAdmin) ? 'admin' : 'member',
      });
    } else {
      // Existing user - update if needed
      // Promote to admin if env phone matches and not already admin
      if (isEnvAdmin && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
      }
      if (photoURL && !user.avatar) {
        user.avatar = photoURL;
        await user.save();
      }
      // Update name if provided
      if (name && name !== user.name) {
        user.name = name;
        await user.save();
      }
    }

    res.json({ user });
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ message: 'সিঙ্ক ব্যর্থ' });
  }
};
