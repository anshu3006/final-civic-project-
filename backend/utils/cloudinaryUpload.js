const cloudinary = require('../config/cloudinary');

/**
 * Upload a file buffer to Cloudinary and return the result.
 * @param {Buffer} fileBuffer - The image buffer from multer
 * @param {string} folder    - Cloudinary folder name
 * @returns {Promise<object>} Cloudinary upload result (secure_url, public_id, etc.)
 */
function uploadToCloudinary(fileBuffer, folder = 'micro-task-issues') {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    stream.end(fileBuffer);
  });
}

module.exports = { uploadToCloudinary };
