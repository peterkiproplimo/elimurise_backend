const express = require('express');
const router = express.Router();
const SchoolService = require('../../../services/portal/SchoolService');
const multer = require('multer');
const path = require('path');
const {checkPermission} = require('../../../middleware/portal-auth');

const schoolService = new SchoolService();
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/elimurise/'); // specify the destination directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // set the file name
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: Images Only!');
    }
  },
});
// GET /schools
router.get('/', checkPermission('school', 'read'), async (req, res) => {
  try {
    const {page, limit, search, county, subcounty} = req.query;
    query = {};
    if (county) {
      query.county = county;
    }
    if (subcounty) {
      query.subcounty = subcounty;
    }
    const schools = await schoolService.getSchools(page, limit, query);
    res.json(schools);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// POST /schools
router.post('/', checkPermission('school', 'create'), async (req, res) => {
  try {
    const schoolData = req.body;
    const createdSchool = await schoolService.createSchool(schoolData);
    res.status(201).json(createdSchool);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// PUT /schools/:id
router.put(
  '/update',
  checkPermission('school', 'update'),
  upload.fields([
    {name: 'logo', maxCount: 1},
    {name: 'school_stamp', maxCount: 1},
    {name: 'school_head_teacher_signature', maxCount: 1},
    {name: 'signatory_signature', maxCount: 1},
  ]),
  async (req, res) => {
    try {
      let id = req?.user?.school;
      const schoolData = req.body;

      // Handle file uploads
      if (req.files?.logo) {
        schoolData.logo = req.files.logo[0].path;
      }
      
      if (req.files?.school_stamp) {
        schoolData.school_stamp = req.files.school_stamp[0].path;
      }
      if (req.files?.school_head_teacher_signature) {
        schoolData.school_head_teacher_signature = req.files.school_head_teacher_signature[0].path;
      }
      if (req.files?.signatory_signature) {
        schoolData.signatory_signature = req.files.signatory_signature[0].path;
      }

      console.log(schoolData);
      const updatedSchool = await schoolService.updateSchool(id, schoolData);
      res.json(updatedSchool);
    } catch (error) {
      res.status(404).json({error: error.message});
    }
  },
);
router.get('/current', checkPermission('school', 'read'), async (req, res) => {
  try {
    let id = req?.user?.school;
    console.log(id);
    const School = await schoolService.getschool(id);
    res.json({data: School, success: true});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
