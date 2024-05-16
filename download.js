import fs from 'fs';
import path from 'path';
import https from 'https';

const dirtyUrl = "https://cdn.discordapp.com/attachments/401765372241641474/1240222260497879060/IMG_8308.png?ex=6645c67d&is=664474fd&hm=e2642619ba4801d5bbea1a9dbc49394641f7866e4f7703d4deaa8c0d16dcdff8&";
const cleanUrl = cleanURL(dirtyUrl);
const filename = path.basename(cleanUrl);
const filepath = "./temp/" + filename;
const extension = path.extname(filename).toLowerCase();
downloadFile(dirtyUrl, filepath);

let mimeType;
if (mimeTypes.hasOwnProperty(extension)) {
  mimeType = mimeTypes[extension];
} else {
  console.error(`Unsupported file type: ${filename}`);
  // You can throw an error or handle the unsupported file here (e.g., reject upload)
  return; // Exit the function if file type is not supported
}

function cleanURL(url) {
  // Use URL object to parse the URL
  const urlObject = new URL(url);
  // Return only the origin and pathname
  return urlObject.origin + urlObject.pathname;
}

function downloadFile(dirtyUrl, filepath) {
  https.get(dirtyUrl, (res) => {
    const fileStream = fs.createWriteStream(filepath);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
        fileStream.close();
        console.log('Download finished.')
    });
  })
}
