import fs from 'fs';
import path from 'path';
import https from 'https';

// Mime Types
const mimeTypes = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
  wav: 'audio/wav',
  mp3: 'audio/mp3',
  aiff: 'audio/aiff',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  mpg: 'video/mpg',
  mpeg: 'video/mpeg',
  mov: 'video/mov',
  avi: 'video/avi',
  flv: 'video/x-flv',
  webm: 'video/webm',
  wmv: 'video/wmv',
  '3gp': 'video/3gpp',
};

export function cleanURL(url) {
  const urlObject = new URL(url);
  return urlObject.origin + urlObject.pathname;
}

export function generateRandomString(length) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () =>
    characters.charAt(Math.floor(Math.random() * characters.length))
  ).join('');
}

export async function downloadFile(dirtyUrl, filepath) {
  return new Promise((resolve, reject) => {
    https
      .get(dirtyUrl, (res) => {
        const fileStream = fs.createWriteStream(filepath);
        res.pipe(fileStream)
          .on('finish', () => {
            fileStream.close();
            console.log('\x1b[33mAttachment received.\x1b[0m');
            resolve();
          })
          .on('error', (err) => {
            fs.unlink(filepath, () => reject(err));
          });
      })
      .on('error', (err) => reject(err));
  });
}

export function getMimeType(extension) {
  return mimeTypes[extension.toLowerCase()] || null;
}

// New utility function to delete files
export function deleteFile(filepath) {
  fs.unlink(filepath, (err) => {
    if (err) {
      console.error('Error deleting file:', err);
    } else {
      console.log(`\x1b[33mFile "${filepath}" deleted.\x1b[0m`);
    }
  });
}

export async function deleteFileFromGemini(fileName, fileManager) {
  try {
    await fileManager.deleteFile(fileName);
    console.log(`\x1b[33m"${fileName}" deleted from Gemini.\x1b[0m`);
  } catch (error) {
    if (error.status === 403) {
      console.error(`\x1b[31mPermission denied to delete file "${fileName}".\x1b[0m`);
    } else if (error.status === 404) {
      console.error(`\x1b[31mFile "${fileName}" not found.\x1b[0m`);
    } else {
      console.error('\x1b[31mError deleting file:\x1b[0m', error);
    }
    // Optionally, re-throw the error if you want to handle it further up the chain
    // throw error;
  }
}