// server/controllers/notificationController.js
import Notification from '../models/Notification.js';

export const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('createdBy', 'name');
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'নোটিফিকেশন আনতে ব্যর্থ' });
  }
};

export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      $or: [
        { targetUser: null },
        { targetUser: req.user._id },
      ],
    }).sort({ createdAt: -1 }).limit(20);
    res.json({ notifications });
  } catch (err) {
    res.status(500).json({ message: 'নোটিফিকেশন আনতে ব্যর্থ' });
  }
};

export const createNotification = async (req, res) => {
  try {
    const { title, message, type, targetUser } = req.body;
    const notification = await Notification.create({
      title,
      message,
      type: type || 'info',
      targetUser: targetUser || null,
      createdBy: req.user._id,
    });
    res.status(201).json({ notification });
  } catch (err) {
    res.status(500).json({ message: 'তৈরি ব্যর্থ' });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    await Notification.findByIdAndDelete(req.params.id);
    res.json({ message: 'মুছে ফেলা হয়েছে' });
  } catch (err) {
    res.status(500).json({ message: 'মুছতে ব্যর্থ' });
  }
};

export const markRead = async (req, res) => {
  try {
    await Notification.findByIdAndUpdate(req.params.id, {
      $addToSet: { isRead: req.user._id },
    });
    res.json({ message: 'পঠিত হিসেবে চিহ্নিত' });
  } catch (err) {
    res.status(500).json({ message: 'আপডেট ব্যর্থ' });
  }
};
