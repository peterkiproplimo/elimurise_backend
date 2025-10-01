const express = require('express');
const router = express.Router();
const {google} = require('googleapis');
const multer = require('multer');
const path = require('path');
const {checkPermission} = require('../../../middleware/portal-auth');

// Google Drive API setup
const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'credentials.json'), // Path to your Google API credentials
  scopes: ['https://www.googleapis.com/auth/drive.file'],
});
const drive = google.drive({version: 'v3', auth});

// Multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Temporary local storage
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Accept all file types, modify as needed
    cb(null, true);
  },
});

// POST /upload-to-drive
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({error: 'No file uploaded'});
    }

    const fileMetadata = {
      name: req.file.originalname,
      // Optional: specify folder ID to upload to a specific folder
      // parents: ['your-folder-id']
    };

    const media = {
      mimeType: req.file.mimetype,
      body: require('fs').createReadStream(req.file.path),
    };

    // Upload file to Google Drive
    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, webViewLink',
    });

    // Delete temporary file
    require('fs').unlinkSync(req.file.path);

    // Construct the file URL
    const fileUrl = response.data.webViewLink;

    res.status(201).json({
      message: 'File uploaded successfully',
      url: fileUrl,
      fileId: response.data.id,
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({error: 'Failed to upload file to Google Drive'});
  }
});

module.exports = router;
