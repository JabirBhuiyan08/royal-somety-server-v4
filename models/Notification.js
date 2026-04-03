// server/models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['info', 'warning', 'success', 'alert'], default: 'info' },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // null = broadcast
  isRead: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

const Notification = mongoose.model('Notification', notificationSchema);
export default Notification;
