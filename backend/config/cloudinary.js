const cloudinary = require('cloudinary').v2;

// Auto-configures from CLOUDINARY_URL env variable,
// or you can set individual keys:
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;
