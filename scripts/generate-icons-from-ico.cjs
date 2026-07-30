const fs = require('fs');
const sharp = require('sharp');
const path = require('path');

const icoPath = path.join(__dirname, '..', 'public', 'focus-icon.ico');
const buf = fs.readFileSync(icoPath);
const offset = buf.readUInt32LE(18);
const pngData = buf.slice(offset);

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
];

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(pngData)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'icons', name));
    console.log(`Generated ${name}`);
  }
}

generate().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});