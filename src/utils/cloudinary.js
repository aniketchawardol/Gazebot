import { v2 as cloudinary } from 'cloudinary';
import https from 'node:https';
import http from 'node:http';

/**
 * Configure the Cloudinary SDK from environment variables.
 */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a PNG buffer to Cloudinary.
 * @param {Buffer} buffer - The image buffer to upload.
 * @param {string} folder - The Cloudinary folder path.
 * @returns {Promise<string>} The secure URL of the uploaded image.
 */
export async function uploadBuffer(buffer, folder = 'gazebot') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        format: 'png',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      },
    );
    uploadStream.end(buffer);
  });
}

/**
 * Fetch an image from a URL and return it as a Buffer.
 * @param {string} url - The image URL to fetch.
 * @returns {Promise<Buffer>} The image data as a Buffer.
 */
export async function fetchImageBuffer(url) {
  const client = url.startsWith('https') ? https : http;
  return new Promise((resolve, reject) => {
    client.get(url, (res) => {
      // Follow redirects (3xx)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchImageBuffer(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to fetch image: HTTP ${res.statusCode}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}
