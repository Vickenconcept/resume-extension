// Simple Node.js script to generate extension icons
// Run: node generate-icons.js

const fs = require('fs');
const path = require('path');

// Minimal valid PNG data for each size
// These are base64-encoded 1x1 PNGs that we'll create programmatically
function createPNG(size, color, text) {
  // Create a simple PNG using canvas-like approach
  // For a simple solution, we'll create actual valid PNG bytes
  
  // This is a minimal valid PNG (1x1 pixel, orange background)
  // We'll use a library-free approach by creating a very simple PNG
  
  // Actually, let's just create minimal valid PNGs using a template
  // A 1x1 PNG with orange background
  
  // For now, create files that tell user to use the HTML generator
  const message = `This is a placeholder. Please:
1. Open generate-icons.html in your browser
2. Click "Download All Icons"
3. Save the downloaded files in this folder

Or use any image editor to create:
- icon16.png (16x16 pixels, orange background, white "R")
- icon48.png (48x48 pixels, orange background, white "R")  
- icon128.png (128x128 pixels, orange background, white "R")`;

  // But Chrome needs actual PNGs, so let's create minimal valid ones
  // Using a very simple PNG structure
  
  // Create minimal valid PNG header + data
  const pngSignature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  
  // For a real solution, we need actual PNG creation
  // Since we can't use external libs easily, let's provide instructions
  
  console.log(`\nTo generate icons, please:\n`);
  console.log(`1. Open 'generate-icons.html' in your browser`);
  console.log(`2. Click "Download All Icons" button`);
  console.log(`3. Place the downloaded PNG files in this folder\n`);
  console.log(`OR use any image editor to create:`);
  console.log(`- icon16.png (16x16, orange #f97316, white "R" letter)`);
  console.log(`- icon48.png (48x48, orange #f97316, white "R" letter)`);
  console.log(`- icon128.png (128x128, orange #f97316, white "R" letter)\n`);
}

// Check if canvas is available (would need npm install canvas)
try {
  const { createCanvas } = require('canvas');
  
  const sizes = [16, 48, 128];
  sizes.forEach(size => {
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');
    
    // Orange background
    ctx.fillStyle = '#f97316';
    ctx.fillRect(0, 0, size, size);
    
    // White "R" letter
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.floor(size * 0.6)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('R', size / 2, size / 2);
    
    // Save as PNG
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(`icon${size}.png`, buffer);
    console.log(`Created icon${size}.png`);
  });
  
  console.log('\nAll icons created successfully!');
} catch (e) {
  // Canvas not available, show instructions
  createPNG();
  console.log('\nNote: Install "canvas" package for automatic generation:');
  console.log('npm install canvas');
}
