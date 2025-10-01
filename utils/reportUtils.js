const fs = require('fs');
const logger = require('./logger');
const path = require('path');

/**
 * Generate base64 image data URL from file path
 */
function generateImageDataUrl(filePath, fallback = '') {
  if (!filePath || !fs.existsSync(filePath)) {
    logger.warn(`Image file not found: ${filePath}`);
    return fallback;
  }
  
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const base64Image = imageBuffer.toString('base64');
    const imageType = path.extname(filePath).toLowerCase() === '.png' ? 'image/png' : 'image/jpeg';
    return `data:${imageType};base64,${base64Image}`;
  } catch (error) {
    logger.error(`Error reading image file ${filePath}:`, error);
    return fallback;
  }
}

/**
 * Generate school stamp data URL
 */
function generateSchoolStampUrl(school) {
  if (!school || !school.school_stamp) {
    return '';
  }
  return generateImageDataUrl(school.school_stamp);
}

/**
 * Generate signatory signature data URL
 */
function generateSignatorySignatureUrl(school) {
  if (!school || !school.signatory_signature) {
    return '';
  }
  return generateImageDataUrl(school.signatory_signature);
}

/**
 * Generate school logo data URL
 */
function generateSchoolLogoUrl(school) {
  if (!school || !school.logo) {
    return '';
  }
  return generateImageDataUrl(school.logo);
}

/**
 * Generate hero logo data URL
 */
function generateElimuriseLogoUrl() {
  const herologo = 'logo.png';
  return generateImageDataUrl(herologo);
}

/**
 * Get signatory information with fallbacks
 */
function getSignatoryInfo(school) {
  return {
    role: school.signatory_role || 'Head Teacher',
    name: school.signatory_name || '',
    signature: generateSignatorySignatureUrl(school)
  };
}

/**
 * Generate common report CSS variables
 */
function generateReportCSS(school) {
  return {
    primaryColor: school.primaryColor || '#ff3333',
    secondaryColor: school.secondaryColor || '#33cc33',
    accent1: '#0066ff',
    accent2: '#ffcc00'
  };
}

module.exports = {
  generateImageDataUrl,
  generateSchoolStampUrl,
  generateSignatorySignatureUrl,
  generateSchoolLogoUrl,
  generateElimuriseLogoUrl,
  getSignatoryInfo,
  generateReportCSS
}; 