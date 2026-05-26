// server/routes/memberRoutes.js
import express from 'express';
import {
  getMyTransactions, requestDeposit, getTargets,
  getEmergencyList, getGallery, uploadGalleryPhoto,
  deleteOwnPhoto, updateProfile, getMonthlyStatus,
  getTotalBalance, createSocialMedia, getSocialMedia,
  updateSocialMedia, deleteSocialMedia, deleteSocialMediaField,
} from '../controllers/userController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getMyNotifications, markRead } from '../controllers/notificationController.js';
import { uploadGallery, uploadMultipleProfile } from '../middleware/upload.js';

const router = express.Router();
router.use(verifyToken);

router.get('/total-balance', getTotalBalance);
router.get('/transactions', getMyTransactions);
router.post('/transactions/deposit', requestDeposit);
router.get('/monthly-status', getMonthlyStatus);
router.get('/targets', getTargets);
router.get('/emergency-list', getEmergencyList);
router.get('/gallery', getGallery);
router.post('/gallery', uploadGallery.single('photo'), uploadGalleryPhoto);
router.delete('/gallery/:id', deleteOwnPhoto);
router.post('/social-media', createSocialMedia);
router.get('/social-media', getSocialMedia);
router.patch('/social-media', updateSocialMedia);
router.delete('/social-media', deleteSocialMedia);
router.delete('/social-media/:field', deleteSocialMediaField);
router.patch('/profile', uploadMultipleProfile, updateProfile);
router.get('/notifications', getMyNotifications);
router.patch('/notifications/:id/read', markRead);

export default router;
