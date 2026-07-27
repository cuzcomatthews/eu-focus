const sharp = require('sharp');
const path = require('path');

const sizes = [
  { name: 'icon-192.png', size: 192 },
  { name: 'icon-512.png', size: 512 },
];

// Simple SVG icon with the gradient and leaf symbol from the app's logo
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="100%" style="stop-color:#8b5cf6"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="100" fill="url(#bg)"/>
  <g transform="translate(256,256)">
    <!-- Leaf icon from the sidebar -->
    <path d="M0 0 C-20 -40 -60 -60 -100 -80 C-80 -40 -60 -20 0 0Z" 
          fill="white" opacity="0.9" transform="rotate(-30)"/>
    <path d="M0 0 C20 -40 60 -60 100 -80 C80 -40 60 -20 0 0Z" 
          fill="white" opacity="0.7" transform="rotate(30)"/>
    <circle cx="0" cy="10" r="8" fill="white" opacity="0.95"/>
  </g>
  <!-- Small timer circle indicator -->
  <circle cx="256" cy="350" r="30" fill="none" stroke="white" stroke-width="4" opacity="0.3"/>
  <circle cx="256" cy="350" r="30" fill="none" stroke="white" stroke-width="4" opacity="0.7"
          stroke-dasharray="188" stroke-dashoffset="47" transform="rotate(-90 256 350)"/>
</svg>`;

async function generate() {
  for (const { name, size } of sizes) {
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, '..', 'public', 'icons', name));
    console.log(`Generated ${name}`);
  }
  // Also generate apple touch icon at 180x180
  await sharp(Buffer.from(svgIcon))
    .resize(180, 180)
    .png()
    .toFile(path.join(__dirname, '..', 'public', 'icons', 'apple-touch-icon.png'));
  console.log('Generated apple-touch-icon.png');
}

generate().catch(console.error);