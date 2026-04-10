// server/controllers/userController.js
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Target from '../models/Target.js';
import Gallery from '../models/Gallery.js';
import { cloudinary } from '../middleware/upload.js';
import { dispatchGalleryUpload } from '../services/notificationDispatcher.js';
import { clearUserCache } from '../middleware/authMiddleware.js';

export const getTotalBalance = async (req, res) => {
  try {
    const agg = await User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]);
    res.json({ totalBalance: agg[0]?.total || 0 });
  } catch (err) { res.status(500).json({ message: 'ব্যালেন্স আনতে ব্যর্থ' }); }
};

export const getMyTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50);
    res.json({ transactions });
  } catch (err) { res.status(500).json({ message: 'লেনদেন আনতে ব্যর্থ' }); }
};

export const requestDeposit = async (req, res) => {
  try {
    const { amount, note, paymentMonth, target } = req.body;
    if (!amount || amount < 1) return res.status(400).json({ message: 'পরিমাণ সঠিক নয়' });
    const tx = await Transaction.create({ 
      user: req.user._id, 
      amount: Number(amount), 
      type: 'deposit', 
      status: 'pending', 
      note, 
      paymentMonth,
      target: target || null 
    });
    res.status(201).json({ message: 'জমার অনুরোধ পাঠানো হয়েছে', transaction: tx });
  } catch (err) { res.status(500).json({ message: 'অনুরোধ ব্যর্থ হয়েছে' }); }
};

export const getTargets = async (req, res) => {
  try {
    const targets = await Target.find({ isActive: true }).sort({ createdAt: -1 });
    
// Calculate collected amount for each target from approved transactions
    const targetsWithCollected = await Promise.all(targets.map(async (t) => {
      const agg = await Transaction.aggregate([
        { $match: { target: t._id, status: 'approved', type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return {
        ...t.toObject(),
        collected: agg[0]?.total || 0
      };
    }));
    
    res.json({ targets: targetsWithCollected });
  } catch (err) { res.status(500).json({ message: 'লক্ষ্য আনতে ব্যর্থ' }); }
};

export const getEmergencyList = async (req, res) => {
  try {
    const members = await User.find({ isActive: true }).select('name phone bloodGroup memberId avatar').sort({ name: 1 });
    res.json({ members });
  } catch (err) { res.status(500).json({ message: 'তালিকা আনতে ব্যর্থ' }); }
};

export const getGallery = async (req, res) => {
  try {
    const photos = await Gallery.find()
      .populate('uploadedBy', 'name avatar memberId')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ photos });
  } catch (err) { res.status(500).json({ message: 'গ্যালারি আনতে ব্যর্থ' }); }
};

// ── Any member can upload to gallery ─────────────────────────────────────────
export const uploadGalleryPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'কোনো ছবি পাঠানো হয়নি' });
    const photo = await Gallery.create({
      url: req.file.path,
      publicId: req.file.filename,
      caption: req.body.caption || '',
      uploadedBy: req.user._id,
    });
    // Notify others (background)
    dispatchGalleryUpload(req.user, photo.caption).catch(console.error);
    const populated = await photo.populate('uploadedBy', 'name avatar memberId');
    res.status(201).json({ message: 'ছবি আপলোড হয়েছে', photo: populated });
  } catch (err) { res.status(500).json({ message: 'আপলোড ব্যর্থ' }); }
};

// ── Delete own gallery photo ──────────────────────────────────────────────────
export const deleteOwnPhoto = async (req, res) => {
  try {
    const photo = await Gallery.findById(req.params.id);
    if (!photo) return res.status(404).json({ message: 'ছবি পাওয়া যায়নি' });
    if (String(photo.uploadedBy) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'শুধু নিজের ছবি মুছতে পারবেন' });
    }
    if (photo.publicId) await cloudinary.uploader.destroy(photo.publicId);
    await photo.deleteOne();
    res.json({ message: 'ছবি মুছে ফেলা হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'মুছতে ব্যর্থ' }); }
};

// ── Update own profile (name, phone, blood, avatar, coverPhoto) ───────────────
export const updateProfile = async (req, res) => {
  try {
    const { name, phone, bloodGroup } = req.body;
    const update = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    // Allow setting or clearing bloodGroup
    if (bloodGroup !== undefined) {
      update.bloodGroup = bloodGroup || null;
    }

    if (req.files?.avatar?.[0]) update.avatar = req.files.avatar[0].path;
    if (req.files?.cover?.[0])  update.coverPhoto = req.files.cover[0].path;
    // Single-field upload (avatar only)
    if (req.file) update.avatar = req.file.path;

    const user = await User.findByIdAndUpdate(req.user._id, update, { new: true });
    // Clear cache so next request gets fresh data
    if (user && user.uid) clearUserCache(user.uid);
    res.json({ message: 'প্রোফাইল আপডেট হয়েছে', user });
  } catch (err) { res.status(500).json({ message: 'আপডেট ব্যর্থ হয়েছে' }); }
};

// ── Get monthly payment status for current year ───────────────────────────────
export const getMonthlyStatus = async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const months = Array.from({ length: 12 }, (_, i) => {
      const m = String(i + 1).padStart(2, '0');
      return `${year}-${m}`;
    });

    const txs = await Transaction.find({
      user: req.user._id,
      paymentMonth: { $in: months },
    }).select('paymentMonth status amount').lean();

    const statusMap = {};
    for (const m of months) {
      const tx = txs.find(t => t.paymentMonth === m);
      statusMap[m] = tx
        ? { status: tx.status, amount: tx.amount, txId: tx._id }
        : { status: 'unpaid', amount: 0, txId: null };
    }

    res.json({ year, months: statusMap });
  } catch (err) {
    res.status(500).json({ message: 'মাসিক তথ্য আনতে ব্যর্থ' });
  }
};
