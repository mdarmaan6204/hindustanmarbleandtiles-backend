import express from 'express';
import multer from 'multer';
import imagekit from '../utils/imagekit.js';

const router = express.Router();
const upload = multer();

router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ ok: false, message: 'No file uploaded' });
    
    // Check if ImageKit is configured
    if (!process.env.IMAGEKIT_PUBLIC_KEY || !process.env.IMAGEKIT_PRIVATE_KEY) {
      console.warn('⚠️ ImageKit not configured. Image upload skipped.');
      return res.status(500).json({ 
        ok: false, 
        message: 'ImageKit not configured. Please add IMAGEKIT credentials to .env file.',
        error: 'Missing ImageKit configuration'
      });
    }
    
    imagekit.upload({
      file: req.file.buffer,
      fileName: req.file.originalname,
      folder: '/products'
    }, (err, result) => {
      if (err) {
        console.error('ImageKit upload error:', err);
        return res.status(500).json({ 
          ok: false, 
          message: 'Image upload failed', 
          error: err.message 
        });
      }
      console.log('✅ Image uploaded:', result.url);
      res.json({ ok: true, imageUrl: result.url });
    });
  } catch (err) {
    console.error('Upload route error:', err);
    res.status(500).json({ ok: false, message: err.message });
  }
});

export default router;
