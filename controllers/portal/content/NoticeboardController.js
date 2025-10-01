const express = require('express');
const NoticeBoardService = require('../../../services/portal/NoticeboardService');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/hero/'); // specify the destination directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // set the file name
  },
});
const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  },
});

// Create a new notice
router.post('/', upload.single('attachment'), async (req, res) => {
  try {
    const school = req?.user?.school;
    const user = req?.user?._id;

    if (!school) {
      return res.status(400).json({success: false, message: 'School ID is required'});
    }

    const {title, message, publishOn} = req.body;

    if (!title || !message || !publishOn) {
      return res.status(400).json({success: false, message: 'Title, message, and publish date are required'});
    }

    const noticeData = {
      ...req.body,
      school,
      createdBy: user,
      attachment: req.file ? req.file.path : null, // Save file path if uploaded
    };

    const notice = await NoticeBoardService.createNotice(noticeData);

    res.status(201).json({success: true, message: 'Notice created successfully', data: notice});
  } catch (error) {
    console.error('Error creating notice:', error);
    res.status(500).json({success: false, message: 'Internal server error', error: error.message});
  }
});

// Get all notices for the logged-in user's school
router.get('/', async (req, res) => {
  try {
    const school = req?.user?.school;

    if (!school) {
      return res.status(400).json({success: false, message: 'School ID is required'});
    }

    const notices = await NoticeBoardService.getAllNotices(school);
    res.status(200).json({success: true, data: notices});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Get a specific notice by its ID
router.get('/:noticeId', async (req, res) => {
  try {
    const notice = await NoticeBoardService.getNoticeById(req.params.noticeId);

    if (!notice || notice.school.toString() !== req?.user?.school.toString()) {
      return res.status(403).json({success: false, message: 'Unauthorized to access this notice'});
    }

    res.status(200).json({success: true, data: notice});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Update a notice
router.put('/:noticeId', upload.single('attachment'), async (req, res) => {
  try {
    const notice = await NoticeBoardService.getNoticeById(req.params.noticeId);

    if (!notice || notice.school.toString() !== req?.user?.school._id.toString()) {
      return res.status(403).json({success: false, message: 'Unauthorized to update this notice'});
    }
    const updatedNotice = await NoticeBoardService.updateNotice(req.params.noticeId, req.body);
    res.status(200).json({success: true, message: 'Notice updated successfully', data: updatedNotice});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

// Delete a notice
router.delete('/:noticeId', async (req, res) => {
  try {
    const notice = await NoticeBoardService.getNoticeById(req.params.noticeId);

    if (!notice || notice.school._id.toString() !== req?.user?.school._id.toString()) {
      return res.status(403).json({success: false, message: 'Unauthorized to delete this notice'});
    }

    await NoticeBoardService.deleteNotice(req.params.noticeId);
    res.status(200).json({success: true, message: 'Notice deleted successfully'});
  } catch (error) {
    res.status(500).json({success: false, message: error.message});
  }
});

module.exports = router;
