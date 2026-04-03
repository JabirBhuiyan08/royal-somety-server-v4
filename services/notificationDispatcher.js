// server/services/notificationDispatcher.js
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import {
  sendTransactionApprovedEmail,
  sendTransactionRejectedEmail,
  sendGalleryUploadEmail,
  sendDueReminderEmail,
  sendCustomEmail,
} from './emailService.js';
import {
  sendWhatsApp,
  wpTransactionApproved,
  wpTransactionRejected,
  wpGalleryUpload,
  wpDueReminder,
  wpCustom,
} from './whatsappService.js';

// ── Save in-app notification ──────────────────────────────────────────────────
const saveNotification = async ({ title, message, type = 'info', targetUser = null, createdBy = null }) => {
  try {
    return await Notification.create({ title, message, type, targetUser, createdBy });
  } catch (err) {
    console.error('Notification save error:', err.message);
  }
};

// ── TRANSACTION APPROVED ─────────────────────────────────────────────────────
export const dispatchTransactionApproved = async (user, transaction, adminId) => {
  const title = 'জমা অনুমোদিত হয়েছে ✅';
  const message = `আপনার ৳${transaction.amount.toLocaleString()} জমার অনুরোধ অনুমোদিত হয়েছে। বর্তমান ব্যালেন্স: ৳${user.balance.toLocaleString()}`;

  await Promise.allSettled([
    // In-app
    saveNotification({ title, message, type: 'success', targetUser: user._id, createdBy: adminId }),
    // Email
    sendTransactionApprovedEmail(user, transaction),
    // WhatsApp
    user.phone && sendWhatsApp(user.phone, wpTransactionApproved(user.name, transaction.amount, user.balance)),
  ]);
};

// ── TRANSACTION REJECTED ─────────────────────────────────────────────────────
export const dispatchTransactionRejected = async (user, transaction, adminId) => {
  const title = 'জমার অনুরোধ বাতিল হয়েছে ❌';
  const message = `দুঃখিত, আপনার ৳${transaction.amount.toLocaleString()} জমার অনুরোধ বাতিল হয়েছে।`;

  await Promise.allSettled([
    saveNotification({ title, message, type: 'alert', targetUser: user._id, createdBy: adminId }),
    sendTransactionRejectedEmail(user, transaction),
    user.phone && sendWhatsApp(user.phone, wpTransactionRejected(user.name, transaction.amount)),
  ]);
};

// ── GALLERY UPLOAD (broadcast to all) ────────────────────────────────────────
export const dispatchGalleryUpload = async (uploader, caption) => {
  const title = '📸 গ্যালারিতে নতুন ছবি';
  const message = `${uploader.name} গ্যালারিতে নতুন ছবি যোগ করেছেন।${caption ? ` "${caption}"` : ''}`;

  // Broadcast in-app notification
  await saveNotification({ title, message, type: 'info', targetUser: null, createdBy: uploader._id });

  // Get all active members except uploader
  const members = await User.find({
    isActive: true,
    _id: { $ne: uploader._id },
  }).select('email phone name').lean();

  await Promise.allSettled([
    sendGalleryUploadEmail(members, uploader.name, caption),
    ...members
      .filter(m => m.phone)
      .map(m => sendWhatsApp(m.phone, wpGalleryUpload(uploader.name, caption))),
  ]);
};

// ── DUE PAYMENT REMINDER ─────────────────────────────────────────────────────
export const dispatchDueReminder = async (user, dueAmount, adminId) => {
  const title = '⚠️ বকেয়া পেমেন্ট রিমাইন্ডার';
  const message = `আপনার ৳${dueAmount.toLocaleString()} বকেয়া রয়েছে। অনুগ্রহ করে দ্রুত পরিশোধ করুন।`;

  await Promise.allSettled([
    saveNotification({ title, message, type: 'warning', targetUser: user._id, createdBy: adminId }),
    sendDueReminderEmail(user, dueAmount),
    user.phone && sendWhatsApp(user.phone, wpDueReminder(user.name, dueAmount)),
  ]);
};

// ── CUSTOM ADMIN MESSAGE ─────────────────────────────────────────────────────
export const dispatchCustomNotification = async ({
  targetUsers,  // array of user docs; if empty → broadcast to all
  title,
  message,
  type = 'info',
  sendEmailFlag = false,
  sendWhatsAppFlag = false,
  adminId,
}) => {
  let users = targetUsers;
  let targetUserIds = [];

  if (!users || users.length === 0) {
    // Broadcast — no targetUser in Notification doc
    await saveNotification({ title, message, type, targetUser: null, createdBy: adminId });
    if (sendEmailFlag || sendWhatsAppFlag) {
      users = await User.find({ isActive: true }).select('name email phone').lean();
    }
  } else {
    // Individual in-app notifications
    await Promise.all(
      users.map(u =>
        saveNotification({ title, message, type, targetUser: u._id, createdBy: adminId })
      )
    );
  }

  const jobs = [];
  if (users && (sendEmailFlag || sendWhatsAppFlag)) {
    for (const u of users) {
      if (sendEmailFlag && u.email) jobs.push(sendCustomEmail(u, title, message));
      if (sendWhatsAppFlag && u.phone) jobs.push(sendWhatsApp(u.phone, wpCustom(u.name, title, message)));
    }
  }
  await Promise.allSettled(jobs);
};
