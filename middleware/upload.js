// server/middleware/upload.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Gallery storage
const galleryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'khanbari-somity/gallery',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, quality: 'auto:good' }],
  },
});

// Avatar storage
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'khanbari-somity/avatars',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
  },
});

// Cover photo storage
const coverStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'khanbari-somity/covers',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 480, crop: 'fill', quality: 'auto' }],
  },
});

// Memory storage for multer.fields (separate uploads)
const memoryStorage = multer.memoryStorage();

const fileSizeLimit = (mb) => mb * 1024 * 1024;

export const uploadGallery = multer({ storage: galleryStorage, limits: { fileSize: fileSizeLimit(8) } });
export const uploadAvatar  = multer({ storage: avatarStorage,  limits: { fileSize: fileSizeLimit(3) } });
export const uploadCover   = multer({ storage: coverStorage,   limits: { fileSize: fileSizeLimit(5) } });

// For profile updates supporting avatar AND/OR cover in same request
// We route each field through its own Cloudinary folder using dynamic params
const profileDynamicStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => {
    if (file.fieldname === 'cover') {
      return {
        folder: 'khanbari-somity/covers',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, height: 480, crop: 'fill', quality: 'auto' }],
      };
    }
    // avatar (default)
    return {
      folder: 'khanbari-somity/avatars',
      allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
      transformation: [{ width: 400, height: 400, crop: 'fill', quality: 'auto' }],
    };
  },
});

const profileMulter = multer({
  storage: profileDynamicStorage,
  limits: { fileSize: fileSizeLimit(5) },
});

export const uploadMultipleProfile = profileMulter.fields([
  { name: 'avatar', maxCount: 1 },
  { name: 'cover',  maxCount: 1 },
]);

export { cloudinary };
