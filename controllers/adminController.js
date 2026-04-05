// server/controllers/adminController.js
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Target from '../models/Target.js';
import Gallery from '../models/Gallery.js';
import { cloudinary } from '../middleware/upload.js';
import mongoose from 'mongoose';
import {
  dispatchTransactionApproved,
  dispatchTransactionRejected,
  dispatchGalleryUpload,
  dispatchDueReminder,
  dispatchCustomNotification,
} from '../services/notificationDispatcher.js';
import { clearUserCache } from '../middleware/authMiddleware.js';

export const getStats = async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const [totalMembers, newThisMonth, balanceAgg, monthlyAgg, targets] = await Promise.all([
      User.countDocuments({ isActive: true }),
      User.countDocuments({ createdAt: { $gte: startOfMonth } }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
      Transaction.aggregate([
        { $match: { status: 'approved', type: 'deposit', createdAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Target.find({ isActive: true }).select('title goal category').lean(),
    ]);
    
    // Calculate collected amount for each target from approved transactions
    const targetsWithCollected = await Promise.all(targets.map(async (t) => {
      const agg = await Transaction.aggregate([
        { $match: { target: t._id, status: 'approved', type: 'deposit' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]);
      return {
        ...t,
        collected: agg[0]?.total || 0
      };
    }));
    
    res.json({ totalMembers, newThisMonth, totalBalance: balanceAgg[0]?.total || 0, monthlyCollection: monthlyAgg[0]?.total || 0, targets: targetsWithCollected });
  } catch (err) { res.status(500).json({ message: 'পরিসংখ্যান আনতে ব্যর্থ' }); }
};

export const getTransactions = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const filter = status ? { status } : {};
    const transactions = await Transaction.find(filter)
      .populate('user', 'name memberId avatar phone email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * Number(limit))
      .limit(Number(limit));
    res.json({ transactions });
  } catch (err) { res.status(500).json({ message: 'লেনদেন আনতে ব্যর্থ' }); }
};

export const approveTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const tx = await Transaction.findById(req.params.id).populate('user').session(session);
    if (!tx) return res.status(404).json({ message: 'লেনদেন পাওয়া যায়নি' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'ইতিমধ্যে প্রক্রিয়া হয়েছে' });
    tx.status = 'approved'; tx.approvedBy = req.user._id; tx.approvedAt = new Date();
    await tx.save({ session });
    const updatedUser = await User.findByIdAndUpdate(tx.user._id, {
      $inc: { balance: tx.type === 'deposit' ? tx.amount : -tx.amount, transactionCount: 1, monthlyDeposit: tx.type === 'deposit' ? tx.amount : 0 },
    }, { session, new: true });
    await session.commitTransaction();
    dispatchTransactionApproved(updatedUser, tx, req.user._id).catch(console.error);
    res.json({ message: 'অনুমোদিত হয়েছে', transaction: tx });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ message: 'অনুমোদন ব্যর্থ' });
  } finally { session.endSession(); }
};

export const rejectTransaction = async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id).populate('user');
    if (!tx) return res.status(404).json({ message: 'লেনদেন পাওয়া যায়নি' });
    if (tx.status !== 'pending') return res.status(400).json({ message: 'ইতিমধ্যে প্রক্রিয়া হয়েছে' });
    tx.status = 'rejected'; tx.approvedBy = req.user._id; tx.approvedAt = new Date();
    await tx.save();
    dispatchTransactionRejected(tx.user, tx, req.user._id).catch(console.error);
    res.json({ message: 'বাতিল করা হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'বাতিল ব্যর্থ' }); }
};

export const sendDueReminder = async (req, res) => {
  try {
    const { userId, dueAmount } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });
    await dispatchDueReminder(user, Number(dueAmount), req.user._id);
    res.json({ message: 'রিমাইন্ডার পাঠানো হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'রিমাইন্ডার পাঠানো ব্যর্থ' }); }
};

export const getAllMembers = async (req, res) => {
  try {
    const members = await User.find().sort({ createdAt: -1 });
    res.json({ members });
  } catch (err) { res.status(500).json({ message: 'সদস্য তালিকা আনতে ব্যর্থ' }); }
};

export const updateMemberRole = async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'member'].includes(role)) return res.status(400).json({ message: 'অবৈধ ভূমিকা' });
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (user && user.uid) clearUserCache(user.uid);
    res.json({ message: 'ভূমিকা আপডেট হয়েছে', user });
  } catch (err) { res.status(500).json({ message: 'আপডেট ব্যর্থ' }); }
};

export const deleteMember = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    await User.findByIdAndUpdate(req.params.id, { isActive: false });
    if (user && user.uid) clearUserCache(user.uid);
    res.json({ message: 'সদস্য নিষ্ক্রিয় করা হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'মুছতে ব্যর্থ' }); }
};

export const sendAdminNotification = async (req, res) => {
  try {
    const { title, message, type = 'info', targetUserIds = [], sendEmail = false, sendWhatsApp = false } = req.body;
    let targetUsers = [];
    if (targetUserIds.length > 0) {
      targetUsers = await User.find({ _id: { $in: targetUserIds }, isActive: true }).select('name email phone').lean();
    }
    await dispatchCustomNotification({ targetUsers, title, message, type, sendEmailFlag: sendEmail, sendWhatsAppFlag: sendWhatsApp, adminId: req.user._id });
    res.json({ message: 'নোটিফিকেশন পাঠানো হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'পাঠানো ব্যর্থ' }); }
};

export const createTarget = async (req, res) => {
  try {
    const { title, category, goal, description, deadline } = req.body;
    const target = await Target.create({ title, category, goal: Number(goal), description, deadline, createdBy: req.user._id });
    res.status(201).json({ message: 'লক্ষ্য তৈরি হয়েছে', target });
  } catch (err) { res.status(500).json({ message: 'লক্ষ্য তৈরি ব্যর্থ' }); }
};

export const updateTarget = async (req, res) => {
  try {
    const target = await Target.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: 'লক্ষ্য আপডেট হয়েছে', target });
  } catch (err) { res.status(500).json({ message: 'আপডেট ব্যর্থ' }); }
};

export const deleteTarget = async (req, res) => {
  try {
    await Target.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'লক্ষ্য মুছে ফেলা হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'মুছতে ব্যর্থ' }); }
};

export const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'কোনো ছবি পাঠানো হয়নি' });
    const photo = await Gallery.create({
      url: req.file.path, publicId: req.file.filename,
      caption: req.body.caption || '', uploadedBy: req.user._id,
    });
    dispatchGalleryUpload(req.user, photo.caption).catch(console.error);
    res.status(201).json({ message: 'ছবি আপলোড হয়েছে', photo });
  } catch (err) { res.status(500).json({ message: 'আপলোড ব্যর্থ' }); }
};

export const deletePhoto = async (req, res) => {
  try {
    const photo = await Gallery.findById(req.params.id);
    if (!photo) return res.status(404).json({ message: 'ছবি পাওয়া যায়নি' });
    if (photo.publicId) await cloudinary.uploader.destroy(photo.publicId);
    await photo.deleteOne();
    res.json({ message: 'ছবি মুছে ফেলা হয়েছে' });
  } catch (err) { res.status(500).json({ message: 'মুছতে ব্যর্থ' }); }
};

// ─── ADMIN UPLOAD ON BEHALF OF MEMBER ────────────────────────────────────────
export const adminUploadForMember = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { memberId, amount, paymentMonth, note, target } = req.body;
    const member = await User.findById(memberId).session(session);
    if (!member) return res.status(404).json({ message: 'সদস্য পাওয়া যায়নি' });

    const tx = await Transaction.create([{
      user: member._id,
      amount: Number(amount),
      type: 'deposit',
      status: 'approved',
      paymentMonth: paymentMonth || null,
      note: note || `অ্যাডমিন কর্তৃক আপলোড`,
      target: target || null,
      uploadedByAdmin: true,
      approvedBy: req.user._id,
      approvedAt: new Date(),
    }], { session });

    const updatedMember = await User.findByIdAndUpdate(member._id, {
      $inc: { balance: Number(amount), transactionCount: 1 },
    }, { session, new: true });

    await session.commitTransaction();

    // Notify member
    const { dispatchTransactionApproved } = await import('../services/notificationDispatcher.js');
    dispatchTransactionApproved(updatedMember, tx[0], req.user._id).catch(console.error);

    res.status(201).json({ message: 'পেমেন্ট যোগ করা হয়েছে', transaction: tx[0] });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ message: 'পেমেন্ট যোগ ব্যর্থ' });
  } finally {
    session.endSession();
  }
};
