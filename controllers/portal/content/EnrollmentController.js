const express = require('express');
const router = express.Router();
const EnrollmentService = require('../../../services/portal/EnrollmentService');
const LearnerService = require('../../../services/portal/LearnersService');
const {body, validationResult} = require('express-validator');
const StreamService = require('../../../services/portal/StreamService');
const streamService = new StreamService();
const GradeUserAssignment = require('../../../models/portal/content/grade_teacher_asigment');
const multer = require('multer');
const path = require('path'); // Added for path.extname
const {checkPermission} = require('../../../middleware/portal-auth');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const Role = require('../../../models/portal/auth/roles'); // To get role names
const logger = require('../../../utils/logger'); // Simple message writer

const enrollmentService = new EnrollmentService();
const learnerService = new LearnerService();

// GET / - Get all enrollments
router.get('/', checkPermission('enrollment', 'read'), async (req, res) => {
  const {page, limit, search, stream} = req.query;
  let school = req?.user?.school;
  let current_session = req?.current_session;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const query = {school: req?.user?.school._id, session: current_session};
    if (stream) query.stream = stream;

    const enrollments = await enrollmentService.getEnrollments(page, limit, query, req.user.teacher, search);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed enrollments for ${stream ? `stream ${stream}` : 'all streams'}`,
    });
    logger.info(`Enrollments sent to ${req.user.email} (${roleName})`);

    return res.json(enrollments);
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
      description: `${roleName} couldn’t view enrollments: ${error.message}`,
    });
    logger.error(`Error fetching enrollments for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/elimurise/'); // Where the image goes
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with timestamp
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

// Validation rules for creating a learner
const validateCreateLearner = [
  body('stream').notEmpty().withMessage('Stream is required'),
  body('first_name').notEmpty().withMessage('First name is required'),
  body('surname').notEmpty().withMessage('Surname is required'),
  body('adm_no').notEmpty().withMessage('Admission number is required'),
  body('image').custom((value, {req}) => {
    if (!req.file) throw new Error('Image is required');
    return true;
  }),
];

// POST / - Create a new learner and enroll them
router.post('/', checkPermission('enrollment', 'create'), upload.single('image'), async (req, res) => {
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
    let current_session = req?.current_session;
    const learnerData = {
      ...req.body,
      school: school,
      current_session: current_session,
      image: req.file.path,
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

// POST /enroll - Fetch learners for transition
router.post('/enroll', checkPermission('enrollment', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.school;
    const current_session = req.current_session;
    const {from_grade, from_stream, next_session, to_grade, to_stream} = req.body;

    const updatedEnrollment = await enrollmentService.fetchLearnersTransistion({
      school,
      current_session,
      from_grade,
      from_stream,
      next_session,
      to_grade,
      to_stream,
    });

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} fetched learners for transition from ${from_stream || 'any stream'} to ${
        to_stream || 'next stream'
      }`,
    });
    logger.info(`Transition fetch by ${req.user.email} (${roleName})`);

    res.json(updatedEnrollment);
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
      description: `${roleName} couldn’t fetch transition: ${error.message}`,
    });
    logger.error(`Error fetching transition for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// PUT /enroll - Transition learners to a new grade/stream
router.put('/enroll', checkPermission('enrollment', 'promote'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.school;
    const current_session = req.current_session;
    const {from_grade, from_stream, next_session, to_grade, to_stream, learners, exit} = req.body;

    const updatedEnrollment = await enrollmentService.transitionLearners({
      school,
      current_session,
      from_grade,
      from_stream,
      next_session,
      to_grade,
      to_stream,
      learners,
      exit,
    });

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} transitioned ${learners?.length || 'some'} learners from ${
        from_stream || 'any stream'
      } to ${to_stream || 'next stream'}`,
    });
    logger.info(`Learners transitioned by ${req.user.email} (${roleName})`);

    res.json(updatedEnrollment);
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
      description: `${roleName} couldn’t transition learners: ${error.message}`,
    });
    logger.error(`Error transitioning learners for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// GET /:streamId - Get enrollments for a specific stream
router.get('/:streamId', checkPermission('enrollment', 'read'), async (req, res) => {
  const {streamId} = req.params;
  let current_session = req?.current_session;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const query = {stream: streamId, school: req?.user?.school, session: current_session};
    const updatedEnrollment = await enrollmentService.searchEnrollments(query, 1, 10); // Default page 1, limit 10

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed enrollments for stream ${streamId}`,
    });
    logger.info(`Stream enrollments sent to ${req.user.email} (${roleName})`);

    res.json(updatedEnrollment);
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
      description: `${roleName} couldn’t view stream ${streamId} enrollments: ${error.message}`,
    });
    logger.error(
      `Error fetching stream enrollments for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`,
    );

    res.status(404).json({error: error.message});
  }
});

module.exports = router;
