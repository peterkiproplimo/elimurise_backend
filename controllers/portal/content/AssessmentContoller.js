const express = require('express');
const mongoose = require('mongoose');
const Assessment = require('../../../models/portal/content/Asessment');
const router = express.Router();
const Substrand = require('../../../models/cms/content/substrand');
const Enrollment = require('../../../models/portal/content/Enrollment');
const Term = require('../../../models/portal/content/Term');
const EnrollmentService = require('../../../services/portal/EnrollmentService');
const {body, validationResult} = require('express-validator');
const StreamService = require('../../../services/portal/StreamService');
const {PDFDocument} = require('pdfkit-table-ts');
const path = require('path');
const fs = require('fs');
const pdf = require('html-pdf');
const Grade = require('../../../models/cms/content/grade');
const Stream = require('../../../models/portal/content/Stream');
const LearningArea = require('../../../models/cms/content/learning_area');
const Learner = require('../../../models/portal/content/Learner');
const {checkPermission} = require('../../../middleware/portal-auth');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const logger = require('../../../utils/logger'); // A simple way to write messages

const streamService = new StreamService();
const enrollmentService = new EnrollmentService();

const multer = require('multer');

// Configure multer storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = '/hero/assessments/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, {recursive: true});
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// Configure multer with file type validation and size limit
const upload = multer({
  storage: storage,
  limits: {fileSize: 5 * 1024 * 1024}, // 5MB file size limit
  fileFilter: function (req, file, cb) {
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error('Invalid file type. Only JPEG, JPG, PNG, PDF, DOC, and DOCX are allowed.'));
  },
});

// Validation rules for assessment
const validateAssessment = [
  body('learner').isMongoId().withMessage('Learner ID looks wrong'),
  body('term').isIn(['1', '2', '3']).withMessage('Term must be 1, 2, or 3'),
  body('strand').isMongoId().withMessage('Strand ID looks wrong'),
  body('substrand').isMongoId().withMessage('Substrand ID looks wrong'),
  body('indicator').isMongoId().withMessage('Indicator ID looks wrong'),
  body('learning_area').isMongoId().withMessage('Learning area ID looks wrong'),
  body('score').isInt({min: 1, max: 4}).withMessage('Score must be a number between 1 and 4'),
  // body('method')
  //   .trim()
  //   .notEmpty()
  //   .withMessage('Assessment method is required')
  //   .isString()
  //   .withMessage('Assessment method must be a string'),
  body('additionalDescription').optional().trim().isString().withMessage('Additional description must be a string'),
];

// Check for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const ipAddress = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const endpoint = `${req.baseUrl}${req.path}`;

    AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: 'Wrong info sent, like bad IDs or invalid data',
    });
    logger.warn(`Oops! Bad info sent to ${endpoint}`);
    return res.status(400).json({errors: errors.array()});
  }
  next();
};

// Add or update an assessment with file upload
router.post(
  '/',
  checkPermission('assessment', 'create'),
  upload.single('file'), // Handle single file upload
  // validateAssessment,
  // handleValidationErrors,
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();
    const ipAddress = req.ip || req.connection.remoteAddress;
    const method = req.method;
    const endpoint = `${req.baseUrl}${req.path}`;

    try {
      const data = req.body;
      const {current_session} = req;
      let {learner, indicator, substrand, score, method, additionalDescription} = data;
      score = parseInt(score);
      if (!method) {
        method = 'Written Test';
      }
      // Find the student
      const learnerData = await Learner.findOne({current_session, _id: learner}).session(session);
      if (!learnerData) {
        throw new Error('Student not found');
      }

      // Check if the indicator exists
      const indicatorData = await Substrand.findIndicatorById(substrand, indicator, session);
      if (!indicatorData) {
        throw new Error('Test question or topic not found');
      }

      const indicatorDescription = indicatorData.description;

      if (score === 0) {
        // If the score is 0, remove the old record
        await Assessment.findOneAndDelete({
          session: current_session,
          learner,
          indicator,
        }).session(session);

        await session.commitTransaction();
        session.endSession();

        await AccessLog.create({
          userId: req.user._id,
          email: req.user.email,
          schoolId: req.user.school?._id,
          roleId: req.user.role?._id,
          ipAddress,
          method,
          endpoint,
          status: 'success',
          description: `Removed score for student ${learnerData.first_name} ${learnerData.last_name} because it was 0`,
        });
        logger.info(`Deleted a score for student ${learnerData.first_name} ${learnerData.last_name}`);
        return res.status(200).json({message: 'Assessment deleted because score was 0'});
      }

      // Get the existing assessment to check for score changes
      const existingAssessment = await Assessment.findOne({
        session: current_session,
        learner,
        indicator,
      }).session(session);

      // Set default description based on score if new or score changed
      let defaultDescription = existingAssessment?.description || '';
      const scoreChanged = existingAssessment && existingAssessment.score !== score;
      if (!existingAssessment || scoreChanged) {
        switch (score) {
          case 4:
            defaultDescription = indicatorData.EE;
            break; // Exceeding Expectation
          case 3:
            defaultDescription = indicatorData.ME;
            break; // Meeting Expectation
          case 2:
            defaultDescription = indicatorData.AE;
            break; // Approaching Expectation
          case 1:
            defaultDescription = indicatorData.BE;
            break; // Below Expectation
          default:
            throw new Error('Score isn’t right (needs to be 1-4)');
        }
      }

      // Handle file upload
      let uploadUrl = existingAssessment?.uploadUrl || null;
      if (req.file) {
        const baseUrl = '';
        uploadUrl = `${baseUrl}/hero/assessments/${req.file.filename}`;
      }

      // Add or update the assessment
      const updatedAssessment = await Assessment.findOneAndUpdate(
        {session: current_session, learner, indicator},
        {
          $set: {
            learner,
            term: data.term,
            strand: data.strand,
            substrand,
            indicator,
            learning_area: data.learning_area,
            score,
            method: method || 'Written Test',
            uploadUrl,
            indicator_description: indicatorDescription,
            description: scoreChanged || !existingAssessment ? defaultDescription : additionalDescription,
            additionalDescription: scoreChanged
              ? defaultDescription
              : additionalDescription || existingAssessment?.additionalDescription || '',
            session: current_session,
            stream: learnerData.stream,
            grade: learnerData.grade,
          },
        },
        {new: true, upsert: true, setDefaultsOnInsert: true, session},
      );

      await session.commitTransaction();
      session.endSession();

      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'success',
        description: `Added or updated score ${score} for student ${learnerData.first_name} ${learnerData.last_name}${
          req.file ? ` with file ${req.file.filename}` : ''
        }`,
      });
      logger.info(`Score saved for student ${learner}${req.file ? ` with file ${req.file.filename}` : ''}`);
      res.status(200).json({
        message: updatedAssessment.upserted ? 'Assessment created' : 'Assessment updated',
        assessment: updatedAssessment,
        uploadUrl: req.file ? uploadUrl : undefined,
      });
    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `Problem adding score: ${error.message}`,
      });
      logger.error(`Error adding score: ${error.message}`);
      res.status(400).json({error: error.message});
    }
  },
);
// router.post(
//   '/',
//   checkPermission('assessment', 'create'),
//   validateAssessment,
//   handleValidationErrors,
//   async (req, res) => {
//     const ipAddress = req.ip || req.connection.remoteAddress;
//     const method = req.method;
//     const endpoint = `${req.baseUrl}${req.path}`;

//     try {
//       const {current_session} = req;
//       const {learner, indicator, substrand, score} = req.body;

//       const learnerData = await Learner.findOne({current_session, _id: learner});
//       if (!learnerData) throw new Error('Student not found');

//       const indicatorData = await Substrand.findIndicatorById(substrand, indicator);
//       if (!indicatorData) throw new Error('Test question or topic not found');

//       if (score === 0) {
//         await Assessment.findOneAndDelete({session: current_session, learner, indicator});
//         await logSuccess(
//           req,
//           ipAddress,
//           method,
//           endpoint,
//           `Removed score for student ${learnerData.first_name} ${learnerData.last_name}`,
//         );
//         return res.status(204).json({message: 'Assessment deleted'});
//       }

//       let description = '';
//       switch (score) {
//         case 4:
//           description = indicatorData.EE;
//           break;
//         case 3:
//           description = indicatorData.ME;
//           break;
//         case 2:
//           description = indicatorData.AE;
//           break;
//         case 1:
//           description = indicatorData.BE;
//           break;
//         default:
//           throw new Error('Score must be between 1 and 4');
//       }

//       const updatedAssessment = await Assessment.findOneAndUpdate(
//         {session: current_session, learner, indicator},
//         {
//           $set: {
//             learner,
//             indicator,
//             substrand,
//             score,
//             indicator_description: indicatorData.description,
//             description,
//             session: current_session,
//             stream: learnerData.stream,
//             grade: learnerData.grade,
//           },
//         },
//         {new: true, upsert: true, setDefaultsOnInsert: true},
//       );

//       await logSuccess(
//         req,
//         ipAddress,
//         method,
//         endpoint,
//         `Added or updated score ${score} for student ${learnerData.first_name} ${learnerData.last_name}`,
//       );
//       return res.status(200).json({
//         message: updatedAssessment.upsertedCount > 0 ? 'Assessment created' : 'Assessment updated',
//         assessment: updatedAssessment,
//       });
//     } catch (error) {
//       await logFailure(req, ipAddress, method, endpoint, `Problem adding score: ${error.message}`);
//       const statusCode = error.message.includes('not found') ? 404 : 400;
//       return res.status(statusCode).json({error: error.message});
//     }
//   },
// );

async function logSuccess(req, ipAddress, method, endpoint, description) {
  await AccessLog.create({
    userId: req.user._id,
    email: req.user.email,
    schoolId: req.user.school?._id,
    roleId: req.user.role?._id,
    ipAddress,
    method,
    endpoint,
    status: 'success',
    description,
  });
}

async function logFailure(req, ipAddress, method, endpoint, description) {
  await AccessLog.create({
    userId: req.user?._id,
    email: req.user?.email || 'unknown',
    schoolId: req.user?.school?._id,
    roleId: req.user?.role?._id,
    ipAddress,
    method,
    endpoint,
    status: 'failed',
    description,
  });
}

// Get all assessments (like a list of all scores)
router.get('/', checkPermission('assessment', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const assessments = await Assessment.find()
      .populate('enrollment')
      .populate('learning_area', '-_id name')
      .populate('strand', '-_id name')
      .populate('substrand', '-_id name')
      .populate('indicator');

    // Log that we got the list
    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: 'Got a list of all Assessment ',
    });
    logger.info(`List of scores sent to ${req.user.email}`);
    res.status(200).json(assessments);
  } catch (error) {
    // Log that it failed
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Couldn’t get scores: ${error.message}`,
    });
    logger.error(`Error getting scores: ${error.message}`);
    res.status(404).json({error: error.message});
  }
});

// Get learners with their assessment status
router.get('/assessment-learners', checkPermission('assessment', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {stream, term, indicator, adm_no} = req.query;
    const school = req?.user?.school._id;
    const session = req?.current_session;

    // Validate required query parameters
    if (!stream || !session || !term || !indicator) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: 'Missing some info like school or term',
      });
      logger.warn(`Missing info for learner list`);
      return res.status(400).json({
        error: `Missing required query parameters ${school} || !${stream} || ${session} || ${term} || ${indicator}`,
      });
    }

    // Check if any assessment is published
    const isPublished = await Assessment.exists({
      stream,
      session,
      term,
      indicator,
      published: true,
    });

    // Create and publish indicator
    await enrollmentService.createAndPublishIndicator({stream, term, indicator});

    // Get learners with assessment status
    const learnersWithAssessmentStatus = await enrollmentService.getLearnersWithAssessmentStatus(
      school,
      stream,
      session,
      term,
      indicator,
      adm_no,
    );

    // Log success
    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `Got list of learners with scores for term ${term}`,
    });
    logger.info(`Sent student list to ${req.user.email}`);

    // Include published status in the response
    res.status(200).json({
      data: learnersWithAssessmentStatus,
      published: !!isPublished, // Convert to boolean
    });
  } catch (error) {
    // Log error
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Problem getting student list: ${error.message}`,
    });
    logger.error(`Error getting student list: ${error.message}`);
    res.status(404).json({error: error.message});
  }
});
// Turn scores into words for a report
const rank = score => {
  switch (score) {
    case 4:
      return 'Exceeding Expectation';
    case 3:
      return 'Meeting Expectation';
    case 2:
      return 'Approaching Expectation';
    case 1:
      return 'Below Expectation';
    case 0:
      return 'Assessment not done';
  }
};
const rankSwahili = score => {
  switch (score) {
    case 4:
      return 'Kuzidisha Matarajio'; // Exceeding Expectation
    case 3:
      return 'Kufikia Matarajio'; // Meeting Expectation
    case 2:
      return 'Kukaribia Matarajio'; // Approaching Expectation
    case 1:
      return 'Mbali na Matarajio'; // Below Expectation
    case 0:
      return 'Hajahudhuria'; // Absent
    default:
      return 'Haijulikani'; // Unknown
  }
};

// Figure out how to group scores in a report
const calculateRowspans = assessments => {
  let rowspans = [];
  let strandCounts = {};
  let substrandCounts = {};

  assessments.forEach(assessment => {
    // Check if strand and substrand exist before accessing their _id properties
    const strandId = assessment.strand?._id;
    const substrandId = assessment.substrand?._id;
    
    if (strandId && !strandCounts[strandId]) {
      strandCounts[strandId] = assessments.filter(a => a.strand?._id?.equals(strandId)).length;
    }
    if (substrandId && !substrandCounts[substrandId]) {
      substrandCounts[substrandId] = assessments.filter(a => a.substrand?._id?.equals(substrandId)).length;
    }
    rowspans.push({
      strandRowspan: strandId ? strandCounts[strandId] : 0,
      substrandRowspan: substrandId ? substrandCounts[substrandId] : 0,
    });
  });

  return {rowspans, result: assessments.length};
};

// Get a report for a student’s scores
router.get('/assessments', checkPermission('assessment', 'learners-report'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {term, learning_area, learner, type} = req.query;
    const learner_data = await Learner.findById(learner).populate('stream grade school').lean();

    if (!term || !learning_area) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: 'Missing term or subject info for report ' + (learner_data?.first_name || 'Unknown'),
      });
      logger.warn(`Missing info for report`);
      return res.status(400).json({error: 'Term and Learning Area are required'});
    }

    // Check if learner_data exists
    if (!learner_data) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: 'Learner not found',
      });
      logger.warn(`Learner not found`);
      return res.status(404).json({error: 'Learner not found'});
    }

    const query = {term, learner, learning_area};
    const assessment_data = await Assessment.findOne(query).populate({
      path: 'stream',
      populate: {path: 'school'},
    });

    const session = assessment_data?.session || '';
    let school = assessment_data?.stream?.school || req.user.school;

    let imageDataUrl =
      learner_data.photo && fs.existsSync(learner_data.photo)
        ? `data:image/png;base64,${fs.readFileSync(learner_data.photo).toString('base64')}`
        : '';

    let logoDataUrl =
      school?.logo && fs.existsSync(school.logo)
        ? `data:image/png;base64,${fs.readFileSync(school.logo).toString('base64')}`
        : '';

    let herologoDataUrl = fs.existsSync('logo.png')
      ? `data:image/png;base64,${fs.readFileSync('logo.png').toString('base64')}`
        : '';

    if (type === 'learner-weakness') query.score = {$lte: 2}; // Low scores
    if (type === 'learner-success') query.score = {$gt: 2}; // High scores

    const assessments = await Assessment.find(query)
      .populate('learning_area', '-_id name')
      .populate('strand', 'name')
      .populate('substrand', 'name learning_outcome')
      .populate('indicator');

    // Filter out assessments with null strand or substrand before processing
    const validAssessments = assessments.filter(
      assessment => assessment.strand && assessment.substrand
    );

    const {rowspans, result} = calculateRowspans(validAssessments);
    const learningArea = await LearningArea.findById(learning_area);
    const isSwahili = /kiswahili/i.test(learningArea?.name);

    const data = {
      logoDataUrl,
      school: school || {},
      learner: learner_data,
      term,
      assessments: validAssessments,
      imageDataUrl,
      herologoDataUrl,
      rank: isSwahili ? rankSwahili : rank,
      rowspans,
      result,
      learning_area: learningArea?.name || '',
      session,
      type,
      url: process.env.FILE,
    };

    const html = await new Promise((resolve, reject) => {
      res.render('FormartiveAssessment', data, (err, renderedHtml) => {
        if (err) reject(err);
        resolve(renderedHtml);
      });
    });
    //ss
    const options = {
      format: 'A4',
      border: {top: '0.3in', right: '0.5in', bottom: '0.5in', left: '0.5in'},
      footer: {
        contents: `<hr style="border:2px solid black"><div>Powered By Elimurise.</div><div style="margin-top:10px;color: #444;text-align:center">{{page}}/<span>{{pages}}</div>`,
      },
      childProcessOptions: {env: {OPENSSL_CONF: '/dev/null'}},
    };

    pdf.create(html, options).toBuffer(async (err, buffer) => {
      if (err) {
        await AccessLog.create({
          userId: req.user?._id,
          email: req.user?.email || 'unknown',
          schoolId: req.user?.school?._id,
          roleId: req.user?.role?._id,
          ipAddress,
          method,
          endpoint,
          status: 'failed',
          description: `Couldn’t make PDF report: ${err.message}`,
        });
        logger.error(`PDF error: ${err.message}`);
        return res.status(404).send(err.message);
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
        description: `Made a report for student ${learner_data.first_name}  ${learner_data.last_name}`,
      });
      logger.info(`Report sent to ${req.user.email}`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
      res.send(buffer);
    });
  } catch (error) {
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Problem with report: ${error.message}`,
    });
    logger.error(`Report error: ${error.message}`);
    res.status(404).json({error: error.message});
  }
});

// Get a big analysis report for scores
router.get('/assessments/analysis', checkPermission('assessment', 'analysis-report'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {term, learning_area, grade, stream, type} = req.query;
    let query = {
      learning_area: new mongoose.Types.ObjectId(learning_area),
      term,
      session: req.current_session,
    };

    if (!term || !learning_area) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: 'Missing term or subject for big report',
      });
      logger.warn(`Missing info for big report`);
      return res.status(400).json({error: 'Term and Learning Area are required'});
    }

    let school = req?.user?.school;
    let logoDataUrl =
      school.logo && fs.existsSync(school.logo)
        ? `data:image/png;base64,${fs.readFileSync(school.logo).toString('base64')}`
        : '';
    let herologoDataUrl = fs.existsSync('logo.png')
      ? `data:image/png;base64,${fs.readFileSync('logo.png').toString('base64')}`
      : '';

    if (type === 'analysis-stream') {
      query.stream = new mongoose.Types.ObjectId(stream);
    } else if (type === 'analysis-grade') {
      const streams = await Stream.find({grade}).lean();
      query.stream = {$in: streams.map(s => s._id)};
    }

    const assessments = await Assessment.aggregate([
      {$match: query},
      {$lookup: {from: 'strands', localField: 'strand', foreignField: '_id', as: 'strandDetails'}},
      {$unwind: '$strandDetails'},
      {$lookup: {from: 'substrands', localField: 'substrand', foreignField: '_id', as: 'substrandDetails'}},
      {$unwind: '$substrandDetails'},
      {
        $group: {
          _id: {
            strand: '$strandDetails.name',
            substrand: '$substrandDetails.name',
            indicator: '$indicator',
            indicator_description: '$indicator_description',
          },
          performance: {$push: {score: '$score', learner: '$learner'}},
        },
      },
      {
        $project: {
          strand: '$_id.strand',
          substrand: '$_id.substrand',
          indicator: '$_id.indicator_description',
          performanceCounts: {
            belowExpectation: {
              count: {$size: {$filter: {input: '$performance', cond: {$eq: ['$$this.score', 1]}}}},
              description: 'Below Expectation',
            },
            approachingExpectation: {
              count: {$size: {$filter: {input: '$performance', cond: {$eq: ['$$this.score', 2]}}}},
              description: 'Approaching Expectation',
            },
            meetingExpectation: {
              count: {$size: {$filter: {input: '$performance', cond: {$eq: ['$$this.score', 3]}}}},
              description: 'Meeting Expectation',
            },
            exceedingExpectation: {
              count: {$size: {$filter: {input: '$performance', cond: {$eq: ['$$this.score', 4]}}}},
              description: 'Exceeding Expectation',
            },
          },
        },
      },
      {
        $group: {
          _id: {strand: '$strand', substrand: '$substrand'},
          indicators: {$push: {name: '$indicator', performanceCounts: '$performanceCounts'}},
        },
      },
      {
        $group: {
          _id: '$_id.strand',
          substrands: {$push: {_id: '$_id.substrand._id', substrand: '$_id.substrand', indicators: '$indicators'}},
        },
      },
      {$project: {strand: '$_id', substrands: 1}},
      {$sort: {'substrands.substrand._id': 1, strand: 1}},
    ]);

    const learningArea = await LearningArea.findById(learning_area);
    let header = {};
    if (grade) {
      const gradeObject = await Grade.findById(grade);
      if (!gradeObject) throw new Error('Grade not found');
      header = {grade: gradeObject.name};
    }
    if (stream) {
      const streamObject = await Stream.findById(stream).populate('grade');
      if (!streamObject) throw new Error('Stream not found');
      header = {stream: streamObject.name, grade: streamObject.grade.name};
    }

    const html = await new Promise((resolve, reject) => {
      res.render(
        'FormartiveAnalysis',
        {data: assessments, herologoDataUrl, logoDataUrl, school, learningArea, header},
        (err, renderedHtml) => {
          if (err) reject(err);
          resolve(renderedHtml);
        },
      );
    });

    const options = {
      format: 'A4',
      orientation: 'landscape',
      border: {top: '0.3in', right: '0.5in', bottom: '0.5in', left: '0.5in'},
      footer: {
        contents: `<hr style="border:2px solid black"><div>Powered By Elimurise.</div><div style="margin-top:10px;color: #444;text-align:center">{{page}}/<span>{{pages}}</div>`,
      },
      childProcessOptions: {env: {OPENSSL_CONF: '/dev/null'}},
    };

    pdf.create(html, options).toBuffer(async (err, buffer) => {
      if (err) {
        await AccessLog.create({
          userId: req.user?._id,
          email: req.user?.email || 'unknown',
          schoolId: req.user?.school?._id,
          roleId: req.user?.role?._id,
          ipAddress,
          method,
          endpoint,
          status: 'failed',
          description: `Couldn’t make big report PDF: ${err.message}`,
        });
        logger.error(`Big report PDF error: ${err.message}`);
        return res.status(404).send(err.message);
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
        description: `Made a big report for ${type || 'all'} scores`,
      });
      logger.info(`Big report sent to ${req.user.email}`);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
      res.send(buffer);
    });
  } catch (err) {
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Problem with big report: ${err.message}`,
    });
    logger.error(`Big report error: ${err.message}`);
    res.status(404).json({error: err.message});
  }
});

// Share (publish) assessments so others can see them
router.put('/publish/:id', checkPermission('assessment', 'publish'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {id} = req.params; // The ID of what we’re sharing
    const {term, stream, publish} = req.body;

    if (!term || !stream) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: 'Missing term or class info to share scores',
      });
      logger.warn(`Missing info to share scores`);
      return res.status(400).json({error: 'Term and Stream are required'});
    }

    const query = {indicator: id, term, stream};
    const result = await Assessment.updateMany(query, [
      {
        $set: {
          published: publish, // Toggles published (true -> false, false -> true)
          publishedDate: new Date(),
        },
      },
    ]);

    // Log that we shared it
    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `Shared ${result.nModified} scores for term ${term}`,
    });
    logger.info(`Shared ${result.nModified} scores`);
    res.status(200).json({
      message: `${result.nModified} assessments published successfully`,
    });
  } catch (error) {
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Couldn’t share scores: ${error.message}`,
    });
    logger.error(`Error sharing scores: ${error.message}`);
    res.status(400).json({error: error.message});
  }
});

module.exports = router;
