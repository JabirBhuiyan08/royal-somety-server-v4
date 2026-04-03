// server/routes/adminRoutes.js
import express from 'express';
import {
  getStats, getTransactions, approveTransaction, rejectTransaction,
  getAllMembers, updateMemberRole, deleteMember, sendDueReminder,
  createTarget, updateTarget, deleteTarget,
  uploadPhoto, deletePhoto,
  sendAdminNotification,
  adminUploadForMember,
} from '../controllers/adminController.js';
import { getNotifications, createNotification, deleteNotification } from '../controllers/notificationController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { isAdmin } from '../middleware/adminMiddleware.js';
import { uploadGallery } from '../middleware/upload.js';

const router = express.Router();
router.use(verifyToken, isAdmin);

router.get('/stats', getStats);
router.get('/transactions', getTransactions);
router.patch('/transactions/:id/approve', approveTransaction);
router.patch('/transactions/:id/reject', rejectTransaction);
router.post('/transactions/due-reminder', sendDueReminder);
router.post('/transactions/admin-upload', adminUploadForMember);
router.get('/members', getAllMembers);
router.patch('/members/:id/role', updateMemberRole);
router.delete('/members/:id', deleteMember);
router.post('/targets', createTarget);
router.patch('/targets/:id', updateTarget);
router.delete('/targets/:id', deleteTarget);
router.post('/gallery', uploadGallery.single('photo'), uploadPhoto);
router.delete('/gallery/:id', deletePhoto);
router.post('/notify', sendAdminNotification);
router.get('/notifications', getNotifications);
router.post('/notifications', createNotification);
router.delete('/notifications/:id', deleteNotification);

export default router;
