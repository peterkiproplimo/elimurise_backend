const express = require('express');
const router = express.Router();
const LearnerService = require('../../../services/portal/LearnersService');
const {body, validationResult} = require('express-validator');
const Grade = require('../../../models/cms/content/grade');
const StreamService = require('../../../services/portal/StreamService');
const streamService = new StreamService();
const learnerService = new LearnerService();
const multer = require('multer');
const path = require('path');
const Learner = require('../../../models/portal/content/Learner');
const ParentService = require('../../../services/portal/ParentServce');
const parentService = new ParentService();
const {Parser} = require('json2csv');
const csvParser = require('csv-parser');
const fs = require('fs');
const mongoose = require('mongoose');
const Assessment = require('../../../models/portal/content/Asessment');
const SummativeAssessment = require('../../../models/portal/content/SummativeAssessment');
const Stream = require('../../../models/portal/content/Stream');
const Enrollment = require('../../../models/portal/content/Enrollment');
const {checkPermission} = require('../../../middleware/portal-auth');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const Role = require('../../../models/portal/auth/roles'); // To get role names
const logger = require('../../../utils/logger'); // Simple message writer
const fastCsv = require('fast-csv');

// GET / - Get all learners
router.get('/', checkPermission('learners', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const is_a_teacher = req.user.teacher ? true : false;
    const {page, limit, search, stream, grade, sortField, sortOrder, status, religion} = req.query;
    const sortQuery = sortField ? {[sortField]: sortOrder === 'asc' ? 1 : -1} : null;

    const query = {
      school: req.school,
    };

    // Add search filters if search parameter is provided
    if (search) {
      query.$or = [
        {first_name: {$regex: new RegExp(search, 'i')}},
        {last_name: {$regex: new RegExp(search, 'i')}},
        {surname: {$regex: new RegExp(search, 'i')}},
        {adm_no: {$regex: new RegExp(search, 'i')}},
      ];
    }

    // Add grade filter if provided
    if (grade) query.grade = grade;

    // Add stream filter if provided
    if (stream) query.stream = stream;

    // Add religion filter if provided
    if (religion) query.religion = religion;

    // Add status filter if provided, default to ["L", "G"] if not specified
    if (status) {
      query.status = {$in: Array.isArray(status) ? status : [status]};
    } else {
      query.status = {$in: ['P', 'D']}; // Default to filtering by "Left" or "Exited"
    }

    const learners = await learnerService.getLearners(
      page,
      limit,
      query,
      is_a_teacher,
      req.user,
      req.current_session,
      sortQuery,
    );

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed learners${stream ? ` in stream ${stream}` : ''}${
        grade ? ` in grade ${grade}` : ''
      }${religion ? ` with religion ${religion}` : ''}${
        status ? ` with status ${Array.isArray(status) ? status.join(', ') : status}` : ' with status P,D'
      }`,
    });
    logger.info(`Learners sent to ${req.user.email} (${roleName})`);

    res.json(learners);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t view learners: ${error.message}`,
    });
    logger.error(`Error fetching learners for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// Multer setup for image uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/elimurise/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb('Error: Images Only!');
  },
});

// Multer setup for CSV imports
const importData = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /csv/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb('Error: CSV Only!');
  },
});

// Validation rules for creating a learner
const validateCreateLearner = [
  body('stream').notEmpty().withMessage('Stream is required'),
  body('first_name').notEmpty().withMessage('First name is required'),
  // body('surname').notEmpty().withMessage('Surname is required'),
  body('adm_no').notEmpty().withMessage('Admission number is required'),

  body('image').custom((value, {req}) => {
    if (!req.file) throw new Error('Image is required');
    return true;
  }),
];

// POST / - Create a new learner
router.post('/', checkPermission('learners', 'create'), upload.single('image'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t add learner: missing or bad info`,
      });
      logger.warn(`Validation failed for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({errors: errors.array()});
    }

    let school = req?.user?.school;
    const totalLearners = await Learner.countDocuments({school: school});

    let current_session = req?.current_session;
    const learnerData = {
      ...req.body,
      school: school,
      current_session: current_session,
      image: req?.file?.path ? req.file.path : '',
    };

    const stream = await streamService.getStream(learnerData.stream);
    if (!stream) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t add learner: stream ${learnerData.stream} not found`,
      });
      logger.warn(`Stream not found for ${req.user?.email || 'unknown'} (${roleName})`);
      throw new Error('Stream not found');
    }

    const data = {...learnerData, grade: stream?.grade};
    const createdLearner = await learnerService.createLearner(data);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} added learner ${createdLearner.adm_no} to stream ${learnerData.stream}`,
    });
    logger.info(`Learner created by ${req.user.email} (${roleName})`);

    res.status(201).json({data: createdLearner});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t add learner: ${error.message}`,
    });
    logger.error(`Error creating learner for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// PUT /:id - Update a learner
router.put('/:id', checkPermission('learners', 'update'), upload.single('image'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const learnerData = req.body;
    let updatedLearner;
    if (req?.file?.path) {
      updatedLearner = await learnerService.updateLearner(id, {...learnerData, image: req.file.path});
    } else {
      updatedLearner = await learnerService.updateLearner(id, {...learnerData});
    }

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} updated learner ${id}`,
    });
    logger.info(`Learner updated by ${req.user.email} (${roleName})`);

    res.json(updatedLearner);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t update learner ${id}: ${error.message}`,
    });
    logger.error(`Error updating learner for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// GET /all-by-session - Get learners by session
router.get('/all-by-session', checkPermission('learners', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {stream} = req.query;
    let school = req?.user?.school;
    let session = req?.current_session;

    const history = await Enrollment.find({
      to_stream: stream,
      to_session: session,
      school: school._id,
    }).populate('learner');

    // Remove null learners
    const filteredHistory = history.filter(entry => entry.learner !== null);

    // Sort by first_name
    filteredHistory.sort((a, b) => a.learner.first_name.localeCompare(b.learner.first_name));

    // Extract learners
    const learners = filteredHistory.map(entry => entry.learner);
    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed learners in stream ${stream} for session`,
    });
    logger.info(`Learners by session sent to ${req.user.email} (${roleName})`);

    return res.json({data: learners, success: true});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t view learners by session: ${error.message}`,
    });
    logger.error(
      `Error fetching learners by session for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`,
    );

    res.status(404).json({error: error.message});
  }
});

// GET /:leanerId/history - Get a learner's history
router.get('/:leanerId/history', checkPermission('learners', 'history'), async (req, res) => {
  const {leanerId} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const updatedLearner = await learnerService.getLearnerHistory(leanerId);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed history for learner ${leanerId}`,
    });
    logger.info(`Learner history sent to ${req.user.email} (${roleName})`);

    return res.json(updatedLearner);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t view history for learner ${leanerId}: ${error.message}`,
    });
    logger.error(`Error fetching learner history for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// GET /learning-areas - Get learning areas for a learner
router.get('/learning-areas', checkPermission('learners', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {term, session, learner} = req.query;
    if (!learner || !term) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t get learning areas: missing learner or term`,
      });
      logger.warn(`Missing info for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({error: 'Learner and Term are required'});
    }

    const learningAreaIds = await Assessment.distinct('learning_area', {learner, session, term});
    const learningAreas = await mongoose.model('learning_area').find({_id: {$in: learningAreaIds}});

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed learning areas for learner ${learner} in term ${term}`,
    });
    logger.info(`Learning areas sent to ${req.user.email} (${roleName})`);

    return res.json({data: learningAreas, success: true});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t get learning areas: ${error.message}`,
    });
    logger.error(`Error fetching learning areas for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// GET /tests - Get tests for a learner
router.get('/tests', checkPermission('learners', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const learner = await Learner.findOne({_id: req.query.learner});
    const {term, session} = req.query;

    if (!learner || !term) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t get tests: missing learner or term`,
      });
      logger.warn(`Missing info for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({error: 'Learner and Term are required'});
    }

    const learningAreaIds = await SummativeAssessment.distinct('test', {learner: learner._id, session, term});
    const learningAreas = await mongoose.model('Test').find({_id: {$in: learningAreaIds}});

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed tests for learner ${learner._id} in term ${term}`,
    });
    logger.info(`Tests sent to ${req.user.email} (${roleName})`);

    return res.json({data: learningAreas, success: true});
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t get tests: ${error.message}`,
    });
    logger.error(`Error fetching tests for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// DELETE /:id - Delete a learner
router.delete('/:id', checkPermission('learners', 'delete'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const summative = await Assessment.findOne({learner: id});
    const formative = await SummativeAssessment.findOne({learner: id});
    if (formative || summative) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t delete learner ${id}: has assessment details`,
      });
      logger.warn(`Cannot delete learner ${id} for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({error: 'Cannot delete learner with assessment details'});
    }

    const deletedLearner = await learnerService.deleteLearner(id, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} deleted learner ${id}`,
    });
    logger.info(`Learner deleted by ${req.user.email} (${roleName})`);

    return res.json(deletedLearner);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t delete learner ${id}: ${error.message}`,
    });
    logger.error(`Error deleting learner for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    return res.status(404).json({error: error.message});
  }
});

// PUT /:id/status - Disable a learner
router.put('/:id/status', checkPermission('learners', 'change-status'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const disableLearner = await learnerService.disableLearner(id, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} disabled learner ${id}`,
    });
    logger.info(`Learner disabled by ${req.user.email} (${roleName})`);

    res.json(disableLearner);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t disable learner ${id}: ${error.message}`,
    });
    logger.error(`Error disabling learner for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// POST /import - Import learners from CSV
router.post('/import', checkPermission('learners', 'bulk-import'), importData.single('csvFile'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    if (!req.file) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t import learners: no file uploaded`,
      });
      logger.warn(`No file uploaded for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({success: false, error: 'No file uploaded'});
    }

    let school = req?.school;
    let current_session = req?.current_session;

    const learners = [];
    const errors = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
      .pipe(csvParser({skipLines: 2}))
      .on('data', async data => {
        if (
          data['Grade'] &&
          data['Stream'] &&
          data['Admission No'] &&
          data['First Name'] &&
          data['Surname'] &&
          data['Guardian(Email)']
        ) {
          try {
            const learner = {
              school: school,
              current_session: current_session,
              grade: data['Grade'],
              stream: data['Stream'],
              first_name: data['First Name'],
              last_name: data['Last Name'] || '',
              surname: data['Surname'],
              adm_no: data['Admission No'],
              nemis_no: data['NEMIS No'] || '',
              gender: data['Gender'] === 'Male' ? 'Male' : data['Gender'] === 'Female' ? 'Female' : undefined,
              guardian_relationship: 'Guardian',
              guardian: data['Guardian(Email)'],
              guardian2: data['Guardian 2(Email)'] ? data['Guardian 2(Email)'] : '',
              photo: data['Photo'] || '',
              year_admitted: data['Year Admitted'] || '',
            };
            learners.push(learner);
          } catch (error) {
            errors.push({...data, status: 'Error', error: error.message});
          }
        }
      })
      .on('end', async () => {
        fs.unlinkSync(filePath);

        const processedLearners = await Promise.all(
          learners.map(async learner => {
            try {
              const existingLearner = await Learner.findOne({adm_no: learner.adm_no, school: learner.school});
              const grade = await Grade.findOne({name: {$regex: new RegExp(`^\\s*${learner.grade}\\s*$`, 'i')}});
              if (!grade) throw new Error(`Grade not found: ${learner.grade}`);
              const stream = await Stream.findOne({
                name: {$regex: new RegExp(`^\\s*${learner.stream}\\s*$`, 'i')},
                grade: grade._id,
                school: learner.school,
              });
              if (!stream) throw new Error(`Stream not found: ${learner.stream}`);

              learner.grade = grade._id;
              learner.stream = stream._id;

              const guardian = await parentService.getOneParentByEmailOrId(learner.guardian, learner.school);
              if (!guardian) throw new Error(`Guardian with email "${learner.guardian}" does not exist`);
              learner.guardian = guardian;

              if (learner.guardian2 !== '') {
                const guardian2 = await parentService.getOneParentByEmailOrId(learner.guardian2, learner.school);
                if (!guardian2) throw new Error(`Guardian 2 with email "${learner.guardian2}" does not exist`);
                learner.guardian2 = guardian2;
              } else {
                learner.guardian2 = undefined;
              }

              if (existingLearner) throw new Error(`Learner with admission number "${learner.adm_no}" already exists`);

              const createdLearner = await learnerService.createLearner(learner);
              delete learner.school;
              delete learner.photo;
              delete learner.current_session;

              return {...learner, school: undefined, status: 'Success'};
            } catch (error) {
              delete learner.school;
              delete learner.photo;
              delete learner.current_session;
              errors.push({...learner, status: 'Error', error: error.message});
              return null;
            }
          }),
        );

        const filteredLearners = processedLearners.filter(learner => learner !== null);
        const combinedRecords = [...filteredLearners, ...errors];

        await AccessLog.create({
          userId: req.user._id,
          email: req.user.email,
          schoolId: req.user.school?._id,
          roleId: req.user.role?._id,
          ipAddress,
          method,
          endpoint,
          status: 'success',
          description: `${roleName} imported ${filteredLearners.length} learners with ${errors.length} errors`,
        });
        logger.info(`Learners imported by ${req.user.email} (${roleName})`);

        res.setHeader('Content-Disposition', 'attachment; filename="import_results.csv"');
        res.setHeader('Content-Type', 'text/csv');
        const csvStream = fastCsv.format({headers: true});
        csvStream.pipe(res);
        combinedRecords.forEach(record => csvStream.write(record));
        csvStream.end();
      });
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t import learners: ${error.message}`,
    });
    logger.error(`Error importing learners for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({error: error.message});
  }
});

// POST /export - Export learners to CSV
router.post('/export', checkPermission('learners', 'bulk-import'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {grade, stream} = req.body;
    let school = req?.school;

    const streamData = await Stream.findOne({school, _id: stream}).populate('grade');
    if (!streamData) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t export learners: stream ${stream} not found`,
      });
      logger.warn(`Stream not found for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({error: 'Stream not found'});
    }

    const learners = await Learner.find({school, current_session: req.current_session, stream: streamData._id});
    const jsonData = learners.length
      ? learners.map(learner => ({
          grade: streamData.grade.name,
          stream: streamData.name,
          first_name: learner.first_name,
          last_name: learner.last_name,
          surname: learner.surname || '',
          adm_no: learner.adm_no,
          nemis_no: learner.nemis_no || '',
          gender: learner.gender,
          guardian: learner.guardian_email || '',
          guardian2: learner.guardian_email2 || '',
          year_admitted: learner.year_admitted,
        }))
      : [
          {
            grade: streamData.grade.name,
            stream: streamData.name,
            first_name: 'John',
            last_name: 'Doe',
            surname: 'Doe',
            adm_no: '12345',
            nemis_no: 'NEMIS001',
            gender: 'Male',
            guardian: 'hezijoxix@mailinator.com',
            guardian2: 'hezijoxix@mailinator.com',
            year_admitted: '2021',
          },
        ];

    const csv = exportJsonToCsvNew(jsonData, streamData);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} exported learners from stream ${stream}`,
    });
    logger.info(`Learners exported by ${req.user.email} (${roleName})`);

    res.header('Content-Type', 'text/csv');
    res.attachment(`${streamData.grade.name}_${streamData.name}_students.csv`);
    res.send(csv);
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} couldn’t export learners: ${error.message}`,
    });
    logger.error(`Error exporting learners for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({error: 'Internal server error'});
  }
});

// Helper function to export JSON to CSV
function exportJsonToCsvNew(data, stream) {
  const rows = [];
  const fields = [
    {label: 'Grade', value: 'first_name'},
    {label: 'Stream', value: 'first_name'},
    {label: 'First Name', value: 'first_name'},
    {label: 'Last Name', value: 'last_name'},
    {label: 'Surname', value: 'surname'},
    {label: 'Admission No', value: 'adm_no'},
    {label: 'NEMIS No', value: 'nemis_no'},
    {label: 'Gender', value: 'gender'},
    {label: 'Guardian(Email)', value: 'guardian'},
    {label: 'Guardian 2(Email)', value: 'guardian2'},
    {label: 'Year Admitted', value: 'year_admitted'},
  ];
  const templateHeader = fields.map(f => f.label).join(',') + '\n';

  let csvContent = 'Template for Learners Import\n';
  csvContent += `Grade:, ${stream.grade.name},Stream:,${stream.name}\n`;
  csvContent += templateHeader + '';

  data.forEach(student => {
    const row = [
      student.grade,
      student.stream,
      student.first_name,
      student.last_name,
      student.surname,
      student.adm_no,
      student.nemis_no,
      student.gender,
      student.guardian,
      student.guardian2,
      student.year_admitted,
    ].join(',');
    csvContent += row + '\n';
  });

  return csvContent;
}

module.exports = router;
