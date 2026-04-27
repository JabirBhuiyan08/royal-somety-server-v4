// server/controllers/authController.js
import User from '../models/User.js';
import { clearUserCache } from '../middleware/authMiddleware.js';

// Get available BBRC numbers
export const getAvailableBbrcNumbers = async (req, res) => {
  try {
    // Get all existing memberIds (format: KBBRS-XXXX, but we want BBRCXXXX for frontend)
    const existingUsers = await User.find({}, 'memberId').lean();
    const existingNumbers = existingUsers
      .map(u => u.memberId)
      .filter(Boolean)
      .map(id => {
        // memberId is like KBBRS-0001, extract the number part
        const match = id.match(/KBBRS-(\d+)/);
        return match ? match[1] : null;
      })
      .filter(Boolean);
    
    // Generate numbers 1-9999 and filter out existing ones
    const allNumbers = Array.from({ length: 9999 }, (_, i) => 
      String(i + 1).padStart(4, '0')
    );
    
    const available = allNumbers.filter(num => !existingNumbers.includes(num));
    
    res.json({ numbers: available.slice(0, 500) }); // Return first 500 available
  } catch (err) {
    console.error('Get available BBRC numbers error:', err);
    res.status(500).json({ message: 'BBRC নম্বর লোড করতে ব্যর্থ', error: err.message });
  }
};

// Register new user after Firebase signup — saves full data to MongoDB
export const registerUser = async (req, res) => {
  try {
    const { uid, name, email, phone, bloodGroup, photoURL } = req.body;

    console.log('📥 Register request:', { uid, name, phone, bloodGroup, email });

    // Validate and sanitize bloodGroup FIRST
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const sanitizedBloodGroup = bloodGroup && validBloodGroups.includes(bloodGroup) ? bloodGroup : null;

    console.log('📥 Sanitized bloodGroup:', sanitizedBloodGroup);

    const existing = await User.findOne({ uid });
    if (existing) {
      // Update existing user with the new data (including bloodGroup from signup)
      const updateFields = { name };
      if (phone) updateFields.phone = phone;
      if (sanitizedBloodGroup) updateFields.bloodGroup = sanitizedBloodGroup;
      
      const updated = await User.findByIdAndUpdate(existing._id, updateFields, { new: true });
      clearUserCache(uid);
      console.log('📝 Updated existing user:', { phone, bloodGroup: sanitizedBloodGroup });
      return res.status(200).json({ message: 'সদস্য আপডেট হয়েছে', user: updated });
    }

    // Check if this phone is the designated admin from .env
    const isEnvAdmin = process.env.ADMIN_PHONE &&
      phone?.replace(/\D/g, '') === process.env.ADMIN_PHONE?.replace(/\D/g, '');

    // First user OR env admin phone → admin role
    const count = await User.countDocuments();
    const role = (count === 0 || isEnvAdmin) ? 'admin' : 'member';

    const user = await User.create({
      uid, name, email: phone ? phone + '@khanbari.somity' : undefined, phone, 
      bloodGroup: sanitizedBloodGroup,
      avatar: photoURL || null,
      role,
    });

    console.log('✅ User registered:', { uid, name, phone, memberId: user.memberId, bloodGroup: user.bloodGroup });
    res.status(201).json({ message: 'নিবন্ধন সফল', user });
  } catch (err) {
    if (err.code === 11000) {
      // Check if it's a phone or memberId duplicate
      const userByPhone = await User.findOne({ phone: req.body.phone });
      if (userByPhone) {
        clearUserCache(userByPhone.uid);
        return res.status(200).json({ user: userByPhone });
      }
      // memberId duplicate - find by uid (already created by concurrent request)
      const userByUid = await User.findOne({ uid: req.body.uid });
      if (userByUid) {
        clearUserCache(userByUid.uid);
        return res.status(200).json({ user: userByUid });
      }
      // Both not found - this is a race condition, query by latest created
      const latestUser = await User.findOne().sort({ createdAt: -1 });
      if (latestUser) {
        clearUserCache(latestUser.uid);
        return res.status(200).json({ user: latestUser });
      }
      // Last resort - return what we tried to create
      return res.status(200).json({ user: null });
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
    const { uid, name, phone, photoURL, bloodGroup } = req.body;

    // Validate bloodGroup
    const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
    const sanitizedBloodGroup = bloodGroup && validBloodGroups.includes(bloodGroup) ? bloodGroup : null;

    // Check if this phone is the designated admin from .env
    const isEnvAdmin = process.env.ADMIN_PHONE &&
      phone?.replace(/\D/g, '') === process.env.ADMIN_PHONE?.replace(/\D/g, '');

    // First check if user exists by uid
    let user = await User.findOne({ uid });
    
    if (user) {
      // Existing user - update if needed
      let updated = false;
      
      // Promote to admin if env phone matches and not already admin
      if (isEnvAdmin && user.role !== 'admin') {
        user.role = 'admin';
        updated = true;
      }
      if (photoURL && !user.avatar) {
        user.avatar = photoURL;
        updated = true;
      }
      // Update name if provided
      if (name && name !== user.name) {
        user.name = name;
        updated = true;
      }
      // Update phone if provided
      if (phone && !user.phone) {
        user.phone = phone;
        updated = true;
      }
      // Update bloodGroup if provided and user doesn't have one
      if (sanitizedBloodGroup && !user.bloodGroup) {
        user.bloodGroup = sanitizedBloodGroup;
        updated = true;
      }
      
      if (updated) {
        await user.save();
        // Clear cache after update
        clearUserCache(uid);
      }
      return res.json({ user });
    }

    // New user - check if phone already exists (for duplicate handling)
    const existingByPhone = phone ? await User.findOne({ phone }) : null;
    if (existingByPhone) {
      // Link this Firebase uid to existing user
      existingByPhone.uid = uid;
      if (name && name !== existingByPhone.name) {
        existingByPhone.name = name;
      }
      if (photoURL && !existingByPhone.avatar) {
        existingByPhone.avatar = photoURL;
      }
      await existingByPhone.save();
      clearUserCache(uid);
      return res.json({ user: existingByPhone });
    }

    // Create new user
    try {
      const count = await User.countDocuments();
      user = await User.create({
        uid, 
        name: name || 'সদস্য', 
        phone,
        email: phone ? phone + '@khanbari.somity' : undefined,
        avatar: photoURL || null,
        role: (count === 0 || isEnvAdmin) ? 'admin' : 'member',
      });
      res.json({ user });
    } catch (createErr) {
      if (createErr.code === 11000) {
        // Race condition - user was created by another request
        // Try to find by uid again
        const newUser = await User.findOne({ uid });
        if (newUser) {
          return res.json({ user: newUser });
        }
        // Try by phone
        if (phone) {
          const phoneUser = await User.findOne({ phone });
          if (phoneUser) {
            return res.json({ user: phoneUser });
          }
        }
        // Last resort - find any recent user
        const recentUser = await User.findOne().sort({ createdAt: -1 });
        return res.json({ user: recentUser });
      }
      throw createErr;
    }
  } catch (err) {
    console.error('Sync error:', err);
    res.status(500).json({ message: 'সিঙ্ক ব্যর্থ হয়েছে' });
  }
};
