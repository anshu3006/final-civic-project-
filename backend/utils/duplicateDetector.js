const axios = require("axios");
const sharp = require("sharp");

/*
This function compares a new uploaded image
with existing images stored in Cloudinary.

It downloads existing images, resizes them,
and compares pixel similarity.
*/

async function isDuplicate(uploadedBuffer, existingImageUrls) {
  try {

    // Resize uploaded image
    const uploaded = await sharp(uploadedBuffer)
      .resize(256, 256)
      .grayscale()
      .raw()
      .toBuffer();

    for (let i = 0; i < existingImageUrls.length; i++) {

      const url = existingImageUrls[i];

      try {

        // Download existing image
        const response = await axios.get(url, {
          responseType: "arraybuffer"
        });

        const existing = await sharp(response.data)
          .resize(256, 256)
          .grayscale()
          .raw()
          .toBuffer();

        let diff = 0;

        for (let j = 0; j < uploaded.length; j++) {
          diff += Math.abs(uploaded[j] - existing[j]);
        }

        const avgDiff = diff / uploaded.length;

        // Lower value = more similar
        if (avgDiff < 8) {
          return i;
        }

      } catch (err) {
        console.log("Error checking image:", err.message);
      }
    }

    return false;

  } catch (error) {
    console.log("Duplicate detection error:", error.message);
    return false;
  }
}

module.exports = { isDuplicate };