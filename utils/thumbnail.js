const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
exports.generateThumbnail = async (inputPath, maxSizeKB = 50) => {
  try {
    const width = 100; // Small width
    const height = 100; // Small height
    let quality = 50; // Initial quality

    // Generate thumbnail and get buffer
    let buffer = await sharp(inputPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({quality})
      .toBuffer();

    // Check size
    let fileSizeKB = buffer.length / 1024;

    // Reduce quality if over 50KB
    if (fileSizeKB > maxSizeKB) {
      quality = Math.floor(quality * (maxSizeKB / fileSizeKB));
      buffer = await sharp(inputPath)
        .resize(width, height, {fit: 'cover', position: 'center'})
        .jpeg({quality})
        .toBuffer();

      fileSizeKB = buffer.length / 1024;
    }

    // Save to file (optional, for verification)
    // await fs.writeFile(outputPath, buffer);
    // console.log(`Thumbnail saved at ${outputPath}`);

    // Return base64 data URL
    const base64Image = buffer.toString('base64');
    return `data:image/jpeg;base64,${base64Image}`;
  } catch (error) {
    // console.error('Error generating thumbnail:', error);
    return 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYa';
  }
};
// async function generateReport() {
//   // Generate thumbnail and get data URL
//   const imageDataUrl = await generateThumbnail('/hero/1721946234779.jpg');
//   console.log('Data URL:', imageDataUrl);
// }
// generateReport();
