const multer = require('multer');
const ImageKit = require('imagekit');

// Configure ImageKit
// Replace these with your actual ImageKit credentials from https://imagekit.io/dashboard
const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY || 'your_public_key_here',
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || 'your_private_key_here',
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT || 'https://ik.imagekit.io/your_imagekit_id'
});

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files are allowed!'), false);
    }
    cb(null, true);
  }
});

// Upload image to ImageKit
const uploadImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Upload to ImageKit
    const result = await imagekit.upload({
      file: req.file.buffer.toString('base64'),
      fileName: req.file.originalname,
      folder: '/tile-products', // Organize in folders
      useUniqueFileName: true,
    });

    res.status(200).json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      thumbnailUrl: result.thumbnailUrl
    });

  } catch (error) {
    console.error('ImageKit upload error:', error);
    res.status(500).json({ 
      message: 'Failed to upload image', 
      error: error.message 
    });
  }
};

module.exports = {
  upload,
  uploadImage
};
