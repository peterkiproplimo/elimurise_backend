const express = require('express');
const mongoose = require('mongoose');
const Assessment = require('../../../models/portal/content/Asessment'); // Adjust the path as necessary
const router = express.Router();
const Substrand = require('../../../models/cms/content/substrand');
const Enrollment = require('../../../models/portal/content/Enrollment');
const EnrollmentService = require('../../../services/portal/EnrollmentService');
const Learner = require('../../../models/portal/content/Learner');
const {body, validationResult} = require('express-validator');
const StreamService = require('../../../services/portal/StreamService');
const Term = require('../../../models/portal/content/Term');
const TransferRequest = require('../../../models/portal/content/Transfer');
const {BillingAddress, Payment, PesapalApiService} = require('../../../services/payment/PesapalService');
const PaymentService = new PesapalApiService();
const summativeAssessment = require('../../../services/portal/SummativeAssessmentService'); // Adjust the path as necessary
const Comments = require('../../../models/portal/content/Comments');
const wkhtmltopdf = require('wkhtmltopdf');
const PlDescriptorService = require('../../../services/cms/PlDescriptor'); // Import the service
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const logger = require('../../../utils/logger'); // A simple way to write messages
const {ChartJSNodeCanvas} = require('chartjs-node-canvas');
const chartJSNodeCanvas = new ChartJSNodeCanvas({width: 400, height: 300});

// const session = require('../../../models/portal/content/session');
const streamService = new StreamService();
const fs = require('fs');
const pdf = require('html-pdf');
const SummativeAssessment = require('../../../models/portal/content/SummativeAssessment');
const SummativeAssessmentService = require('../../../services/portal/SummativeAssessmentService');
const LearningArea = require('../../../models/cms/content/learning_area');
const AttendanceService = require('../../../services/portal/AttendanceService');
const {generateThumbnail} = require('../../../utils/thumbnail');
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

const enrollmentService = new EnrollmentService();
// Validation rules
const validateAssessment = [
  body('enrollment').isMongoId().withMessage('Invalid enrollment ID'),
  body('term'),

  body('learning_area').isMongoId().withMessage('Invalid learning area ID'),
  body('strand').isMongoId().withMessage('Invalid strand ID'),
  body('substrand').isMongoId().withMessage('Invalid substrand ID'),
  body('indicator').isMongoId().withMessage('Invalid indicator ID'),
  body('score').optional().isNumeric().withMessage('Score must be a number'),
];

// Middleware to handle validation results
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(404).json({errors: errors.array()});
  }
  next();
};

router.get('/dashboard', async (req, res) => {
  try {
    const session = req.user.school.current_year;
    // const enrollments = await learn.getEnrollmentsByParent(req.user._id, session);
    const learners = await Learner.find({
      $or: [
        {guardian: req.user._id}, // Replace guardianId with the actual value or variable
        {guardian2: req.user._id}, // Use the same guardianId for the second fiel
      ],
      // status: 'P',
    }).populate('stream grade guardian guardian2');

    return res.json({learners, success: true});
  } catch (err) {
    res.status(404).json({error: err.message});
  }
});

router.get('/academic-years', async (req, res) => {
  try {
    const {term, learning_area, strand} = req.query;
    console.log(req.query.learner);
    const enrollments = await Enrollment.find({learner: req.query.learner}).populate('stream'); // Assuming 'year' is the field in session schema
    console.log(enrollments);
    // Extract the academic years from the enrollments
    const sessions = enrollments.map(enrollment => enrollment);

    return res.json({data: sessions, success: true});
  } catch (err) {
    res.status(404).json({data: [], error: err.message});
  }
});
router.get('/learner-classes', async (req, res) => {
  try {
    const {learner} = req.query;
    const grades = await enrollmentService.getLearnerGrades(learner);
    return res.json({data: grades, success: true});
  } catch (err) {
    res.status(404).json({data: [], error: err.message});
  }
});
router.get('/terms', async (req, res) => {
  try {
    const {academic_year} = req.query;
    if (!academic_year) {
      throw Error('Provide academic year');
    }

    const terms = await Term.find({session: academic_year});

    return res.json({data: terms, success: true});
  } catch (err) {
    res.status(404).json({data: [], error: err.message});
  }
});
router.get('/learning-areas', async (req, res) => {
  try {
    // const enrollment = await Enrollment.findOne({learner: req.query.learner}); // Assuming 'year' is the field in session schema

    const {term, session, learner} = req.query;

    if (!learner || !term) {
      return res.status(200).json({data: [], error: 'Learner and Term are required'});
    }
    const learningAreaIds = await Assessment.distinct('learning_area', {learner, session, term});
    const learningAreas = await mongoose.model('learning_area').find({
      _id: {$in: learningAreaIds},
    });

    return res.json({data: learningAreas, success: true});
  } catch (err) {
    res.status(404).json({data: [], error: err.message});
  }
});
router.get('/tests', async (req, res) => {
  try {
    const learner = await Learner.findOne({_id: req.query.learner}); // Assuming 'year' is the field in session schema

    const {term, session} = req.query;

    if (!learner || !term) {
      return res.status(404).json({error: 'Learner and Term are required'});
    }
    const learningAreaIds = await SummativeAssessment.distinct('test', {learner: learner._id, session, term});
    console.log(learningAreaIds);
    const learningAreas = await mongoose.model('Test').find({
      _id: {$in: learningAreaIds},
    });

    return res.json({data: learningAreas, success: true});
  } catch (err) {
    res.status(404).json({data: [], error: err.message});
  }
});
const calculateRowspans = assessments => {
  let rowspans = [];

  let strandCounts = {};
  let substrandCounts = {};

  assessments.forEach(assessment => {
    // Calculate strand rowspan
    if (!strandCounts[assessment.strand._id]) {
      strandCounts[assessment.strand._id] = assessments.filter(a => a.strand._id.equals(assessment.strand._id)).length;
    }

    // Calculate substrand rowspan
    if (!substrandCounts[assessment.substrand._id]) {
      substrandCounts[assessment.substrand._id] = assessments.filter(a =>
        a.substrand._id.equals(assessment.substrand._id),
      ).length;
    }

    rowspans.push({
      strandRowspan: strandCounts[assessment.strand._id],
      substrandRowspan: substrandCounts[assessment.substrand._id],
    });
  });

  return rowspans;
};
router.get('/assessment/with-uploads', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {learner, type} = req.query;

    // Validate required parameters
    if (!learner) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `Missing term, learning_area, or learner for assessment fetch`,
      });
      logger.warn(`Missing required parameters for assessment fetch`);
      return res.status(400).json({error: 'Term, Learning Area, and Learner are required'});
    }

    // Fetch learner data for logging
    const learner_data = await Learner.findById(learner).populate('stream grade school').lean();

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
        description: `Learner not found for assessment fetch`,
      });
      logger.warn(`Learner not found`);
      return res.status(404).json({error: 'Learner not found'});
    }

    // Build query
    const query = {
      learner,
      method: 'Portfolio', // Ensure uploadUrl is defined and non-empty
    };
    query.published = true;
    // Apply score filters based on type
    if (type === 'learner-weakness') query.score = {$lte: 2}; // Low scores
    if (type === 'learner-success') query.score = {$gt: 2}; // High scores

    // Fetch assessments with populated fields
    const assessments = await Assessment.find(query)
      .populate('learner', 'first_name surname last_name adm_no')
      .populate('stream', 'name')
      .populate('grade', 'name')
      .populate('learning_area', 'name')
      .populate('strand', 'name')
      .populate('substrand', 'name learning_outcome')
      .populate('indicator', 'name')
      .lean();

    // Log success
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `Fetched ${assessments.length} assessments with uploads for student ${learner_data.first_name} ${learner_data.last_name}`,
    });
    logger.info(`Assessments with uploads sent to ${req.user?.email || 'unknown'}`);

    // Return assessments
    return res.status(200).json({assessments});
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
      description: `Problem fetching assessments: ${error.message}`,
    });
    logger.error(`Assessment fetch error: ${error.message}`);
    return res.status(500).json({error: error.message});
  }
});
router.get('/assessment/report', async (req, res) => {
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
        description: 'Missing term or subject info for report ' + learner_data.first_name,
      });
      logger.warn(`Missing info for report`);
      return res.status(400).json({error: 'Term and Learning Area are required'});
    }

    const query = {term, learner, learning_area};
    query.published = true;
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
      school.logo && fs.existsSync(school.logo)
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

    const {rowspans, result} = calculateRowspans(assessments);
    const learningArea = await LearningArea.findById(learning_area);

    const data = {
      logoDataUrl,
      school,
      learner: learner_data,
      term,
      assessments,
      imageDataUrl,
      herologoDataUrl,
      rank,
      rowspans,
      result,
      learning_area: learningArea.name,
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

    const options = {
      format: 'A4',
      border: {top: '0.3in', right: '0.5in', bottom: '0.5in', left: '0.5in'},
      footer: {
        contents: `<hr style="border:2px solid black"><div><img src="${herologoDataUrl}" alt="Learner" style="width:50px; border-radius: 5px;">Powered By Elimurise.</div><div style="margin-top:10px;color: #444;text-align:center">{{page}}/<span>{{pages}}</div>`,
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

// router.get('/assessment/report', async (req, res) => {
//   try {
//     const {term, learning_area, learner} = req.query;
//     const query = {};
//     const learningArea = await LearningArea.findById(learning_area);

//     const learner_data = await Learner.findById(learner).populate('stream grade').lean();

//     if (!term || !learningArea) {
//       return res.status(404).json({error: 'Term and Learning Area are required'});
//     }

//     query.term = term;
//     query.learning_area = learning_area;
//     query.published = true;
//     query.learner = learner;
//     const imageFilePath = learner_data.photo || '';

//     let imageDataUrl = '';

//     // Ensure the image file path is valid and exists
//     if (imageFilePath && fs.existsSync(imageFilePath)) {
//       try {
//         const imageBuffer = fs.readFileSync(imageFilePath);
//         const base64Image = imageBuffer.toString('base64');
//         const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
//         imageDataUrl = `data:${imageType};base64,${base64Image}`;
//       } catch (error) {
//         console.error('Error reading or encoding image file:', error);
//       }
//     } else {
//       console.warn('Image file path is invalid or file does not exist:', imageFilePath);
//     }
//     let logoDataUrl = '';
//     let school = req?.user?.school;
//     let herologoDataUrl = '';
//     const herologo = 'logo.png';
//     var _basePath = herologo;

//     if (_basePath && fs.existsSync(_basePath)) {
//       try {
//         const imageBuffer = fs.readFileSync(_basePath);
//         const base64Image = imageBuffer.toString('base64');
//         const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
//         herologoDataUrl = `data:${imageType};base64,${base64Image}`;
//       } catch (error) {
//         console.error('Error reading or encoding image file:', error);
//       }
//     } else {
//       console.warn('Image file path is invalid or file does not exist:', imageDataUrl);
//     }
//     // Ensure the image file path is valid and exists
//     if (school.logo && fs.existsSync(school.logo)) {
//       try {
//         const imageBuffer = fs.readFileSync(school.logo);
//         const base64Image = imageBuffer.toString('base64');
//         const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
//         logoDataUrl = `data:${imageType};base64,${base64Image}`;
//       } catch (error) {
//         console.error('Error reading or encoding image file:', error);
//       }
//     } else {
//       console.warn('Image file path is invalid or file does not exist:');
//     }

//     const assessments = await Assessment.find(query)
//       // .populate('term', '-_id name')
//       .populate('learning_area', '-_id name')
//       .populate('strand', 'name')
//       .populate('substrand', 'name learning_outcome')
//       .populate('indicator');
//     const {rowspans, result} = calculateRowspans(assessments);

//     const data = {
//       logoDataUrl,
//       school,
//       learner: learner_data,
//       term,
//       assessments,
//       imageDataUrl,
//       herologoDataUrl,
//       rank,
//       rowspans,
//       result,
//       learning_area: learningArea.name,
//       type: '',
//       session: school.current_session,
//     };

//     // Render the EJS template and pass the data

//     const html = await new Promise((resolve, reject) => {
//       res.render('FormartiveAssessment', data, (err, renderedHtml) => {
//         if (err) reject(err);
//         resolve(renderedHtml);
//       });
//     });

//     const options = {
//       format: 'A4',
//       border: {
//         top: '0.3in',
//         right: '0.5in',
//         bottom: '0.5in',
//         left: '0.5in',
//       },
//       footer: {
//         contents: `  <hr style="border:2px solid black"><div id="pageHeader"><img src="${herologoDataUrl}"  alt="Learner"
//      style="width:50px;
//             border-radius: 5px;
//            ">Powered By Elimurise. </div>
// <div style="margin-top:10px;color: #444;text-align:center">{{page}}</span>/<span>{{pages}}</div> `,
//       },

//       childProcessOptions: {
//         env: {
//           OPENSSL_CONF: '/dev/null',
//         },
//       },
//     };

//     pdf.create(html, options).toBuffer((err, buffer) => {
//       if (err) {
//         return res.status(404).send(err.message);
//       }

//       res.setHeader('Content-Type', 'application/pdf');
//       res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
//       res.send(buffer);
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(404).json({error: err.message});
//   }
// });
router.get('/assessments-comparison', async (req, res) => {
  try {
    const {term, learner, stream} = req.query;
    const query = {};

    if (!term || !learner) {
      return res.status(404).json({error: 'Term and Learner are required'});
    }

    query.term = term;
    const learner_data = await Learner.findById(learner).populate('grade stream');
    if (!learner_data) {
      return res.status(404).json({error: 'Enrollment not found'});
    }
    query.enrollment = learner_data._id;

    // Load learner photo
    const imageFilePath = learner_data.photo || 'student.jpeg';
    let imageDataUrl = '';

    if (imageFilePath && fs.existsSync(imageFilePath)) {
      try {
        const imageBuffer = fs.readFileSync(imageFilePath);
        const base64Image = imageBuffer.toString('base64');
        imageDataUrl = `data:image/png;base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading learner image file:', imageFilePath, error);
        imageDataUrl = generatePlaceholderImage(); // Fallback to placeholder
      }
    } else {
      logger.warn('Learner image file not found:', imageFilePath);
      imageDataUrl = generatePlaceholderImage(); // Fallback to placeholder
    }

    // Load school logo
    let school = req?.user?.school;
    let logoDataUrl = '';
    if (school.logo && fs.existsSync(school.logo)) {
      const imageBuffer = fs.readFileSync(school.logo);
      const base64Image = imageBuffer.toString('base64');
      logoDataUrl = `data:image/png;base64,${base64Image}`;
    } else {
      logger.warn('School logo not found:', school.logo);
    }

    // Load hero logo
    let herologoDataUrl = '';
    const herologo = 'logo.png';
    if (fs.existsSync(herologo)) {
      const imageBuffer = fs.readFileSync(herologo);
      const base64Image = imageBuffer.toString('base64');
      herologoDataUrl = `data:image/png;base64,${base64Image}`;
    } else {
      logger.warn('Elimurise logo not found:', herologo);
    }

    // Load school stamp and headteacher signature
    let schoolStampDataUrl = '';
    let headteacherSignatureDataUrl = '';
    if (school.school_stamp && fs.existsSync(school.school_stamp)) {
      const imageBuffer = fs.readFileSync(school.school_stamp);
      const base64Image = imageBuffer.toString('base64');
      schoolStampDataUrl = `data:image/png;base64,${base64Image}`;
    }
    if (school.signatory_signature && fs.existsSync(school.signatory_signature)) {
      const imageBuffer = fs.readFileSync(school.signatory_signature);
      const base64Image = imageBuffer.toString('base64');
      headteacherSignatureDataUrl = `data:image/png;base64,${base64Image}`;
    }
    const signatoryRole = school.signatory_role || 'Head Teacher'; // Fallback to "Head Teacher" if not set
    const signatoryName = school.signatory_name || ''; // Empty if not provided
    const signatorySignatureUrl = school.signatory_signature ? `${headteacherSignatureDataUrl}` : '';
    // const teacher_comment = await Comments.findOne({
    //   school: school._id,
    //   session: session,
    //   term: parseInt(term),
    //   learner: new mongoose.Types.ObjectId(learner_data._id),
    //   stream: learner_data.stream._id,
    //   assessment: assessment_data.test,
    //   commentType: 'per-assessment',
    // }).populate('learner');

    // Fetch assessments first to get available assessment IDs
    const assessments = await summativeAssessment.getLearnerAssessmentComparison(
      learner_data,
      term,
      req.current_session,
    );

    // Get the latest assessment comment based on test creation date
    let teacher_comment = null;
    if (assessments && assessments.length > 0 && assessments[0].allTestTypes) {
      // Try to find the comment for the most recently created test
      const allComments = await Comments.find({
        commentType: 'per-assessment',
        school: school._id,
        session: req.current_session,
        term: parseInt(term),
        learner: new mongoose.Types.ObjectId(learner_data._id),
        stream: learner_data.stream._id,
        assessment: { $exists: true } // Ensure assessment field exists
      }).populate('learner assessment');
      
      // Sort by test creation date and get the latest one
      if (allComments && allComments.length > 0) {
        allComments.sort((a, b) => {
          const dateA = a.assessment?.createdAt || new Date(0);
          const dateB = b.assessment?.createdAt || new Date(0);
          return new Date(dateB) - new Date(dateA); // Sort descending (newest first)
        });
        teacher_comment = allComments[0]; // Get the first one after sorting
      }
    }
    console.log('Latest assessment comment:', teacher_comment);
    
    // If no comment exists, create a placeholder or show message
    if (!teacher_comment) {
      console.log('No assessment comment found for this learner. Creating placeholder...');
    }


    // logger.warn(JSON.stringify(assessments[0]));
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Assessment Comparison Report for ${school.name}">
    <meta name="author" content="${school.name}">
    <title>Assessment Comparison - ${school.name}</title>
    <style>
  

:root {
    /* Colors remain unchanged */
    --primary-color: #ff3333; /* Red */
    --secondary-color: #33cc33; /* Green */
    /* School color overrides unchanged */
    ${
      school.primaryColor
        ? school.primaryColor.toLowerCase() === '#ffffff' || school.primaryColor.toLowerCase() === 'white'
          ? '--primary-color: #ff6666;'
          : `--primary-color: ${school.primaryColor};`
        : ''
    }
    ${
      school.secondaryColor
        ? school.secondaryColor.toLowerCase() === '#ffffff' || school.secondaryColor.toLowerCase() === 'white'
          ? '--secondary-color: #66cc66;'
          : `--secondary-color: ${school.secondaryColor};`
        : ''
    }
    --accent1: #0066ff; /* Blue */
    --accent2: #ffcc00; /* Yellow */
}

body {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    background: #ffffff;
    margin: 0;
    padding: 0;
    color: #333;
    font-size: 1em; /* Increased from 0.6em to ensure ~12pt base for print */
}

.watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5em; /* Increased from 3.75em for prominence but kept subtle */
    color: rgba(0, 0, 0, 0.1);
    z-index: -1;
}

.page {
    width: 90%; /* Increased from 85% to utilize A4 width better */
    margin: 40px auto; /* Increased from 30px for more page margin */
    background: white;
    border: 5px solid var(--primary-color); /* Restored to 5px for visibility */
    border-radius: 15px; /* Restored to 15px for consistency */
    padding: 20px; /* Increased from 11.25px for internal spacing */
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Restored original shadow */
    position: relative;
}

.letterhead {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px; /* Increased from 6px */
    color: white;
    color: var(--primary-color);

    border-radius: 10px 10px 0 0; /* Restored to 10px */
    max-height: 150px; /* Increased from 125px */
    overflow: hidden;
    position: relative;
}

.letterhead img {
    width: 120px; /* Restored to 120px for clarity */
    height: auto;
    background: white;
    padding: 2px; /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    margin-left: 10px; /* Restored to 10px */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Restored original shadow */
}

.school-info {
    text-align: center;
    margin-left: 10px; /* Restored to 10px */
}

.school-name {
    font-size: 2em; /* Increased from 1.55em for prominence */
    font-weight: bold;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.3; /* Adjusted for better spacing */
}

.address {
    font-size: 0.9em; /* Increased from 0.6em for readability */
    font-style: italic;
    margin: 3px 0 0 0; /* Increased from 1.5px */
    line-height: 1.3;
}

.report-title {
    text-align: center;
    font-size: 1.6em; /* Increased from 1.975em for emphasis */
    font-weight: bold;
    color: var(--primary-color);
    margin: 7px 0; /* Increased from 7.5px */
    text-transform: uppercase;
    line-height: 1.3;
    position: relative;
}


.info-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 7px 0; /* Increased from 7.5px */
    max-height: 120px; /* Increased from 100px */
    padding-bottom: 7px; /* Increased from 7.5px */
}

.info-container img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: 2px solid var(--primary-color); /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    background: white;
}

.info-table {
    margin-left: 10px; /* Restored to 10px */
    width: 65%; /* Increased from 60% for balance */
    border-collapse: collapse;
}

.info-table td {
    padding: 2px; /* Increased from 3.25px */
    font-size: 1.2em; /* Increased from 1.825em (assuming typo; adjusted to reasonable size) */
    color: #000;
    border-bottom: 1px dashed var(--primary-color); /* Restored to 1px */
    line-height: 1.3;
}

.label {
    font-weight: bold;
    color: var(--primary-color);
}

.result {
    width: 100%;
    border-collapse: collapse;
    margin-top: 15px; /* Restored to 15px */
    background: white;
}

.result th, .result td {
    border: 2px solid var(--primary-color); /* Restored to 2px */
    padding: 2px; /* Increased from 6px */
    text-align: left;
    font-size: 1.2em; /* Increased from 1.2em for table readability */
    color: #333;
    line-height: 1.3;
}

.result th {
    background: var(--primary-color);
    color: white;
    text-transform: uppercase;
}

.result tr:nth-child(even) {
    background: #f9f9f9;
}

.key-section {
    margin: 0; /* Increased from 1.25px for better spacing */
    background: #f9f9f9; /* Light background */
}

.key-section h3 {
    font-size: 1.2em; /* Increased from 1.35em for emphasis */
    color: var(--primary-color);
    margin: 0 0 12px 0; /* Increased from 7.5px */
    text-align: left;
    text-transform: uppercase;
}

.key-table {
    width: 100%; /* Increased from 80% to utilize space */
    margin: 0 auto; /* Centered */
    border-collapse: collapse;
}

.key-table th, .key-table td {
    border: 2px solid var(--primary-color); /* Increased from 1.5px */
    text-align: left;
    font-size: 1em; /* Increased from 1.2em for consistency with result table */
    color: #333;
    font-style: italic;
    padding: 2px; /* Added padding for better spacing */
}

.key-table th {
    background: var(--primary-color); /* Secondary color for header */
    color: white;
    text-transform: uppercase;
}

.key-table tr:nth-child(even) {
    background: #fff; /* White background for even rows */
}

.comments {
    font-size: 1.2em; /* Increased from 1.25em for readability */
    padding: 7px 10px; /* Increased from 7.5px 15px */
    margin: 2px 0; /* Increased from 7.5px */
    border: 2px solid var(--primary-color); /* Restored to 2px */
    background: #fff;
    color: #000;
    border-radius: 10px; /* Restored to 10px */
    line-height: 1;
    position: relative;
    margin-left: 20px; /* Restored to 20px */
}

.comments::before {
    content: '';
    position: absolute;
    top: 10px; /* Restored to 10px */
    left: -20px; /* Restored to -20px */
    width: 0;
    height: 0;
    border: 10px solid transparent; /* Restored to 10px */
    border-right-color: var(--primary-color);
}

.comments::after {
    content: '';
    position: absolute;
    top: 12px; /* Restored to 12px */
    left: -16px; /* Restored to -16px */
    width: 0;
    height: 0;
    border: 8px solid transparent; /* Restored to 8px */
    border-right-color: #fff;
}



.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.3;
}

.signature-section {
    text-align: center;
    border-top: 2px solid var(--primary-color); /* Restored to 2px */
}

.signature {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 300px; /* Restored to 180px */
    margin: auto;
}

.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1.0em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.1;
}
    </style>
</head>
<body>
    <div class="watermark">${school.name}</div>
    <div class="page">
        <div class="letterhead">
            <img src="${logoDataUrl}" alt="School Logo">
            <div class="school-info">
                <div class="school-name">${school.name}</div>
                <div class="address">${school.address}</div>
            </div>
            <div style="width: 90px; margin: 0 7.5px;"></div> <!-- Spacer for balance -->
        </div>
        <div class="report-title">Summative Assessment  REPORT - Term ${term} - ${req.current_session} </div>

        <div class="info-container">
            <img src="${imageDataUrl}" alt="Learner's Profile Picture">
            <table class="info-table">
                <tr>
                    <td><span class="label">NAME:</span> ${learner_data.first_name} ${learner_data.last_name} ${
      learner_data.surname
    }</td>
                </tr>
                <tr>
                    <td><span class="label">ADM NO:</span> ${learner_data.adm_no}</td>
                </tr>
                <tr>
                    <td><span class="label">CLASS:</span> ${learner_data.stream.grade.name}</td>
                </tr>
                <tr>
                    <td><span class="label">STREAM:</span> ${learner_data.stream.name}</td>
                </tr>
            </table>
        </div>
        <table class="result">
            <tr>
                <th>LEARNING AREA</th>`;
    if (assessments.length > 0 && assessments[0].allTestTypes) {
      assessments[0].allTestTypes.forEach(testType => {
        html += `<th><b>${testType}</b></th>`;
        html += `<th><b>DESC</b></th>`;
      });
    }

    html += `</tr>`;
    assessments?.forEach(assessment => {
      html += `
                        <tr>
                            <td>${assessment?.learning_area}</td>`;
      assessment.assessments.forEach(assessment => {
        html += `<td><b>${assessment.score ?? '_'}</b></td>`;
        html += `<td><b>${rank(assessment.gradingScore ?? 0)}</b></td>`;
      });
      html += `
                        </tr>     `;
    });
    const descriptors = await PlDescriptorService.getAllDescriptorsByLanguage();
    // html += `

    //     <div class="key-section">
    //         <h3>Grading Key</h3>
    //         <table class="key-table">
    //             <tr>
    //                 <th>Abbreviation</th>
    //                 <th>Description</th>
    //             </tr>
    //             <tr>
    //                 <td><b>EE</b></td>
    //                 <td>Exceeding Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>ME</b></td>
    //                 <td>Meeting Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>AE</b></td>
    //                 <td>Approaching Expectation</td>
    //             </tr>
    //             <tr>
    //                 <td><b>BE</b></td>
    //                 <td>Below Expectation</td>
    //             </tr>
    //         </table>
    //     </div>`;

    const gradingMap = {
      4: {abbr: 'EE', full: 'Exceeding Expectation'},
      3: {abbr: 'ME', full: 'Meeting Expectation'},
      2: {abbr: 'AE', full: 'Approaching Expectation'},
      1: {abbr: 'BE', full: 'Below Expectation'},
    };
    const chartImageUrl = await generateChartImage(assessments);
    //   html += `
    //   </table>
    //   <div class="graph-section" style="margin: 20px 0;">
    //     <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase;">Performance Graph</h3>
    //     <img src="${chartImageUrl}" alt="Performance Chart" style="max-width: 100%; max-height: 400px;">
    //   </div>

    // // `;
    //   html += `

    // <div class="key-section">
    //     <h3>Grading Key</h3>
    //     <table class="key-table">
    //         <tr>
    //             <th>Abbreviation</th>
    //             <th>Description</th>
    //         </tr>`;

    //   descriptors.forEach(descriptor => {
    //     const abbreviation = gradingMap[descriptor.score] || '-';
    //     const description = descriptor.description.replace(/{{learner}}/g, 'Learner');

    //     html += `
    //         <tr>
    //             <td><b>${abbreviation.abbr}</b></td>
    //             <td><b>${abbreviation.full}</b></td>
    //         </tr>`;
    //   });
    //   html += `
    //     </table>
    // </div>`;
    html += `
    </table>
    <div class="row-container" style="display: flex; margin: 20px 0; gap: 20px;">
      <div class="graph-section" style="flex: 1; max-width: 50%;">
        <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase; margin-bottom: 10px;">Performance Graph</h3>
        <img src="${chartImageUrl}" alt="Performance Chart" style="width: 100%; max-height: 300px; object-fit: contain;">
      </div>
      <div class="key-section" style="flex: 1; max-width: 50%;">
        <h3 style="font-size: 1.2em; color: var(--primary-color); text-align: center; text-transform: uppercase; margin-bottom: 10px;">Grading Key:</h3>
        <table class="key-table" style="width: 100%; border-collapse: collapse;">
          <tr>
            <th style="border: 2px solid var(--primary-color); padding: 5px; background: var(--primary-color); color: white; text-transform: uppercase;">Abbreviation</th>
            <th style="border: 2px solid var(--primary-color); padding: 5px; background: var(--primary-color); color: white; text-transform: uppercase;">Description</th>
          </tr>`;

    descriptors.forEach(descriptor => {
      const abbreviation = gradingMap[descriptor.score] || {abbr: '-', full: '-'};
      const description = descriptor.description.replace(/{{learner}}/g, 'Learner');

      html += `
          <tr>
            <td style="border: 2px solid var(--primary-color); padding: 5px; text-align: left;"><b>${abbreviation.abbr}</b></td>
            <td style="border: 2px solid var(--primary-color); padding: 5px; text-align: left;"><b>${abbreviation.full}</b></td>
          </tr>`;
    });

    html += `
        </table>
      </div>
    </div>`;

    html += `
        <div class="comments">
            <div><b>Class Manager's Report:</b></div>
            <p>${teacher_comment?.comment ?? ''}</p>
        </div>
      `;
    html += `
        </table>
        <div class="signature-section">
            <div class="signature">
                         <img src="${schoolStampDataUrl}" alt="School Stamp">

                <img src="${signatorySignatureUrl}" alt="Signature">
                <div class="signature-label">${signatoryRole}: ${signatoryName}</div>
            </div>
        </div>
    </div>
        <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px;">
          ${school.school_motto || 'Empowering Learners for a Brighter Future'}
        </div>
</body>
</html>`;

    if (!html) {
      return res.status(404).send('HTML content is required');
    }

    const options = {
      format: 'A4',
      border: {
        top: '0.15in' /* Further reduced from 0.225in */,
        right: '0.25in' /* Further reduced from 0.375in */,
        bottom: '0.1in' /* Further reduced from 0.375in */,
        left: '0.25in' /* Further reduced from 0.375in */,
      },
      footer: {
        height: '15mm' /* Reduced height for footer */,
        contents: `<hr style="border:1px solid black; margin: 0;"><div style="display: flex; align-items: center; justify-content: center; padding: 2px 0;"><img src="${herologoDataUrl}" alt="Elimurise Logo" style="width:30px; border-radius:3px; margin-right: 5px;">Powered By Elimurise. <span style="margin-left: 10px; color:#444;">{{page}}/{{pages}}</span></div>`,
      },
      childProcessOptions: {
        env: {
          OPENSSL_CONF: '/dev/null',
        },
      },
    };
    wkhtmltopdf(html, {
      pageSize: 'A4',
      encoding: 'UTF-8',
      // // disableSmartShrinking: true,
      // footerLine: true,

      orientation: 'Portrait', // Optional: change to 'Landscape' if needed
    }).pipe(res);
  } catch (err) {
    console.log(err);
    res.status(404).json({error: err.message});
  }
});
async function getImageDataUrl(filePath) {
  try {
    if (
      filePath &&
      (await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false))
    ) {
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    }
    logger.warn(`Image file not found: ${filePath}`);
    return '';
  } catch (err) {
    logger.warn(`Error reading image file ${filePath}:`, err.message);
    return '';
  }
}

router.get('/tranfer-requests', async (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || 1; // Default to page 1 if not provided
    const limit = parseInt(req.query.limit, 10) || 10; // Default to 10 items per page if not provided

    // Ensure limit is not too high (optional)
    const maxLimit = 100; // Set your maximum limit
    const adjustedLimit = Math.min(limit, maxLimit);

    // Calculate the number of documents to skip
    const skip = (page - 1) * adjustedLimit;
    const learners_list = await Learner.find({
      $or: [
        {guardian: req.user._id}, // Replace guardianId with the actual value or variable
        {guardian2: req.user._id}, // Use the same guardianId for the second fiel
      ],
      status: 'P',
    }).populate('stream grade guardian guardian2');
    // const enrollments = await enrollmentService.getEnrollmentsByParent(req.user._id);
    const learners = learners_list.map(learner => {
      return learner._id.toString();
    });
    // console.log(learners);
    // Find transfer requests with pagination
    const [transferRequests, total] = await Promise.all([
      TransferRequest.find({
        learner: {$in: learners},
      })
        .sort({createdAt: -1})
        .populate('learner oldSchool')
        .populate('newSchool', '-_id name schoolCode')
        .populate('payment')
        .skip(skip)
        .limit(adjustedLimit)
        .exec(),
      TransferRequest.countDocuments({learner: {$in: learners}}).exec(),
    ]);

    // Calculate total pages
    const totalPages = Math.ceil(total / adjustedLimit);

    // Send the result as a response
    return res.status(200).json({
      data: transferRequests,
      pagination: {
        current_page: page,
        total: total,
        total_pages: totalPages,
        per_page: adjustedLimit,
      },
    });
  } catch (err) {
    res.status(404).json({error: err.message});
  }
});
router.post('/pay', async (req, res) => {
  try {
    const {id} = req.body;
    const currentDate = new Date();

    const transferRequest = await TransferRequest.findOne({
      paymentStatus: 'Pending',
      _id: id,
    });
    if (!transferRequest) {
      return res.status(404).json({success: false, error: 'Transfer request not found.'});
    }
    const user = res.user;
    console.log(user);
    const billingAddress = new BillingAddress(
      user?.email,
      user?.phone,
      '254',
      user?.firstname,
      user?.middlename,
      user?.lastname,
      user?.town,
      user?.town,
      user?.county,
      user?.nationality,
      null,
      null,
    );
    //ds

    const payment = new Payment(
      currentDate.getTime(),
      'KES',
      Number(1),
      // Number(billing?.totalCost),
      '67b34af6-d23d-4cd8-a453-de1e1f1fcbaw',
      'Card Online Payment',
      'https://hero.techsavanna.technology/api/payments/approve-transfer',
      billingAddress,
    );
    try {
      const response = await PaymentService.submitOrderRequest(JSON.parse(JSON.stringify(payment)));
      transferRequest.order_tracking_id = response.order_tracking_id;
      transferRequest.save();
      if (response.status == 200) {
        return res.status(response.status).json(response);
      } else {
        return res.status(404).json({error: response.error.message});
      }
    } catch (error) {
      console.log(error);
      return res.status(404).json({error: 'Failed to initiate payment, Contact support'});
    }
    // if (transferRequest.paymentStatus === 'Paid') {
    //   return res.status(404).json({success: false, error: 'Transfer request has already been paid.'});
    // }

    // transferRequest.paymentStatus = 'Paid';
    // const updatedRequest = await transferRequest.save();
  } catch (err) {
    res.status(404).json({success: false, error: err.message});
  }
});

router.get('/summative', async (req, res) => {
  try {
    const {term, learner, test} = req.query;
    const query = {};

    if (!term || !learner) {
      return res.status(404).json({error: 'Term and Learning Area are required'});
    }
    query.term = term;
    const learner_data = await Learner.findOne({_id: learner}).populate('grade stream');
    if (!learner_data) {
      return res.status(404).json({error: 'Learner not found'});
    }

    query.enrollment = learner_data._id;
    const imageFilePath = learner_data.photo || '';
    let imageDataUrl = '';
    const assessment_data = await SummativeAssessment.findOne({test})
      .populate({
        path: 'stream', // Populate stream first
        populate: {
          path: 'school', // Then populate school within stream
        },
      })
      .populate('test'); // Populate test separately

    const session = assessment_data.session;
    let school = assessment_data?.stream?.school;
    // generateThumbnailBase64(imageFilePath).then(base64Image => {
    //   if (base64Image) {
    //     imageBuffer = base64Image;
    //   }
    // });
    let school_stamp = '';
    imageDataUrl = await generateThumbnail(imageFilePath);

    // Ensure the image file path is valid and exists
    // if (imageFilePath && fs.existsSync(imageFilePath)) {
    //   try {
    //     const imageBuffer = fs.readFileSync(imageFilePath);
    //     const base64Image = imageBuffer.toString('base64');
    //     const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
    //     imageDataUrl = `data:${imageType};base64,${base64Image}`;
    //   } catch (error) {
    //     logger.error('Error reading or encoding image file:', error);
    //   }
    // } else {
    //   logger.warn('Image file path is invalid or file does not exist:', imageFilePath);
    // }
    let logoDataUrl = '';
    // let school = req?.user?.school;
    let herologoDataUrl = '';
    const herologo = 'logo.png';
    var _basePath = herologo;

    if (_basePath && fs.existsSync(_basePath)) {
      try {
        const imageBuffer = fs.readFileSync(_basePath);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        herologoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
    }
    let signatory_signature = '';
    if (fs.existsSync(school.school_stamp)) {
      try {
        const imageBuffer = fs.readFileSync(school.school_stamp);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        school_stamp = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
    }
    if (fs.existsSync(school.signatory_signature)) {
      try {
        const imageBuffer = fs.readFileSync(school.signatory_signature);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        signatory_signature = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageDataUrl);
    }
    // Ensure the image file path is valid and exists
    if (school.logo && fs.existsSync(school.logo)) {
      try {
        const imageBuffer = fs.readFileSync(school.logo);
        const base64Image = imageBuffer.toString('base64');
        const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
        logoDataUrl = `data:${imageType};base64,${base64Image}`;
      } catch (error) {
        logger.error('Error reading or encoding image file:', error);
      }
    } else {
      logger.warn('Image file path is invalid or file does not exist:', imageFilePath);
    }
    // console.log('Learner data:', learner_data);
    const {testData, assessments} = await summativeAssessment.getLearnerAssessment(
      learner_data,
      assessment_data.test,
      session,
    );

    const teacher_comment = await Comments.findOne({
      school: school._id,
      session: session,
      term: parseInt(term),
      learner: new mongoose.Types.ObjectId(learner_data._id),
      stream: learner_data.stream._id,
      assessment: assessment_data.test,
      commentType: 'per-assessment',
    }).populate('learner');
    const signatoryRole = school.signatory_role || 'Head Teacher'; // Fallback to "Head Teacher" if not set
    const signatoryName = school.signatory_name || ''; // Empty if not provided
    const signatorySignatureUrl = school.signatory_signature ? `${signatory_signature}` : '';

    // Background image removed - file doesn't exist
    const backgroundImageUrl = '';
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="Fun Report Card for ${school.name}">
    <meta name="author" content="${school.name}">
    <title>Fun Report Card - ${school.name}</title>
    <style>
      

:root {
    /* Colors remain unchanged */
    --primary-color: #ff3333; /* Red */
    --secondary-color: #33cc33; /* Green */
    /* School color overrides unchanged */
    ${
      school.primaryColor
        ? school.primaryColor.toLowerCase() === '#ffffff' || school.primaryColor.toLowerCase() === 'white'
          ? '--primary-color: #ff6666;'
          : `--primary-color: ${school.primaryColor};`
        : ''
    }
    ${
      school.secondaryColor
        ? school.secondaryColor.toLowerCase() === '#ffffff' || school.secondaryColor.toLowerCase() === 'white'
          ? '--secondary-color: #66cc66;'
          : `--secondary-color: ${school.secondaryColor};`
        : ''
    }
    --accent1: #0066ff; /* Blue */
    --accent2: #ffcc00; /* Yellow */
}

body {
    font-family: 'Comic Sans MS', cursive, sans-serif;
    background: #ffffff;
    margin: 0;
    padding: 0;
    color: #333;
    font-size: 1em; /* Increased from 0.6em to ensure ~12pt base for print */
}

.watermark {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 5em; /* Increased from 3.75em for prominence but kept subtle */
    color: rgba(0, 0, 0, 0.1);
    z-index: -1;
}

.page {
    width: 90%; /* Increased from 85% to utilize A4 width better */
    margin: 40px auto; /* Increased from 30px for more page margin */
    background: white;
    border: 5px solid var(--primary-color); /* Restored to 5px for visibility */
    border-radius: 15px; /* Restored to 15px for consistency */
    padding: 20px; /* Increased from 11.25px for internal spacing */
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2); /* Restored original shadow */
    position: relative;
}

.letterhead {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 5px; /* Increased from 6px */
    background: var(--primary-color);
    color: white;
    border-radius: 10px 10px 0 0; /* Restored to 10px */
    border-bottom: 3px dashed var(--secondary-color); /* Restored to 3px */
    max-height: 150px; /* Increased from 125px */
    overflow: hidden;
    position: relative;
}

.letterhead img {
    width: 120px; /* Restored to 120px for clarity */
    height: auto;
    background: white;
    padding: 2px; /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    margin-left: 10px; /* Restored to 10px */
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1); /* Restored original shadow */
}

.school-info {
    text-align: center;
    margin-left: 10px; /* Restored to 10px */
}

.school-name {
    font-size: 2em; /* Increased from 1.55em for prominence */
    font-weight: bold;
    text-transform: uppercase;
    margin: 0;
    line-height: 1.3; /* Adjusted for better spacing */
}

.address {
    font-size: 0.9em; /* Increased from 0.6em for readability */
    font-style: italic;
    margin: 3px 0 0 0; /* Increased from 1.5px */
    line-height: 1.3;
}

.report-title {
    text-align: center;
    font-size: 1.8em; /* Increased from 1.975em for emphasis */
    font-weight: bold;
    color: var(--primary-color);
    margin: 7px 0; /* Increased from 7.5px */
    text-transform: uppercase;
    line-height: 1.3;
    position: relative;
}


.info-container {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin: 7px 0; /* Increased from 7.5px */
    max-height: 120px; /* Increased from 100px */
    border-bottom: 2px dotted var(--primary-color); /* Restored to 2px */
    padding-bottom: 7px; /* Increased from 7.5px */
}

.info-container img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: 2px solid var(--primary-color); /* Restored to 2px */
    border-radius: 10px; /* Restored to 10px */
    background: white;
}

.info-table {
    margin-left: 10px; /* Restored to 10px */
    width: 65%; /* Increased from 60% for balance */
    border-collapse: collapse;
}

.info-table td {
    padding: 2px; /* Increased from 3.25px */
    font-size: 1.2em; /* Increased from 1.825em (assuming typo; adjusted to reasonable size) */
    color: #000;
    border-bottom: 1px dashed var(--primary-color); /* Restored to 1px */
    line-height: 1.3;
}

.label {
    font-weight: bold;
    color: var(--primary-color);
}

.result {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1px; /* Restored to 15px */
    background: white;
}

.result th, .result td {
    border: 2px solid var(--primary-color); /* Restored to 2px */
    padding: 2px; /* Increased from 6px */
    text-align: left;
    font-size: 1.2em; /* Increased from 1.2em for table readability */
    color: #333;
    line-height: 1.3;
}

.result th {
    background: var(--primary-color);
    color: white;
    text-transform: uppercase;
}

.result tr:nth-child(even) {
    background: #f9f9f9;
}

.key-section {
    margin: 0; /* Increased from 1.25px for better spacing */
    background: #f9f9f9; /* Light background */
}

.key-section h3 {
    font-size: 1.2em; /* Increased from 1.35em for emphasis */
    color: var(--primary-color);
    margin: 0 0 12px 0; /* Increased from 7.5px */
    text-align: left;
    text-transform: uppercase;
}

.key-table {
    width: 100%; /* Increased from 80% to utilize space */
    margin: 0 auto; /* Centered */
    border-collapse: collapse;
}

.key-table th, .key-table td {
    border: 2px solid var(--primary-color); /* Increased from 1.5px */
    text-align: left;
    font-size: 1em; /* Increased from 1.2em for consistency with result table */
    color: #333;
    font-style: italic;
    padding: 2px; /* Added padding for better spacing */
}

.key-table th {
    background: var(--primary-color); /* Secondary color for header */
    color: white;
    text-transform: uppercase;
}

.key-table tr:nth-child(even) {
    background: #fff; /* White background for even rows */
}

.comments {
    font-size: 1.2em; /* Increased from 1.25em for readability */
    padding: 7px 10px; /* Increased from 7.5px 15px */
    margin: 2px 0; /* Increased from 7.5px */
    border: 2px solid var(--primary-color); /* Restored to 2px */
    background: #fff;
    color: #000;
    border-radius: 10px; /* Restored to 10px */
    line-height: 1;
    position: relative;
    margin-left: 20px; /* Restored to 20px */
}

.comments::before {
    content: '';
    position: absolute;
    top: 10px; /* Restored to 10px */
    left: -20px; /* Restored to -20px */
    width: 0;
    height: 0;
    border: 10px solid transparent; /* Restored to 10px */
    border-right-color: var(--primary-color);
}

.comments::after {
    content: '';
    position: absolute;
    top: 12px; /* Restored to 12px */
    left: -16px; /* Restored to -16px */
    width: 0;
    height: 0;
    border: 8px solid transparent; /* Restored to 8px */
    border-right-color: #fff;
}



.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.3;
}

.signature-section {
    text-align: center;
    border-top: 2px solid var(--primary-color); /* Restored to 2px */
}

.signature {
    display: flex;
    flex-direction: column;
    align-items: center;
    width: 300px; /* Restored to 180px */
    margin: auto;
}

.signature img {
    width: 100px; /* Restored to 100px */
    height: auto;
    border: none;
    border-radius: 5px; /* Restored to 5px */
}

.signature-label {
    font-size: 1.0em; /* Increased from 1.275em */
    font-weight: bold;
    text-transform: uppercase;
    color: var(--primary-color);
    line-height: 1.1;
}
    </style>
</head>
<body>
    <div class="watermark">${school.name}</div>
    <div class="page">
        <div class="letterhead">
            <img src="${logoDataUrl}" alt="School Logo">
            <div class="school-info">
                <div class="school-name">${school.name}</div>
                <div class="address">${school.address}</div>
            </div>
        </div>
        <div class="report-title">${testData?.name}</div>
        <div class="report-title">
          SUMMATIVE REPORT ${testData?.type} - Term ${term}, ${session}
        </div>
        <div class="info-container">
            <img src="${imageDataUrl}" alt="Learner's Profile Picture">
            <table class="info-table">

     <tr>
                    <td><span class="label">NAME:</span>   ${learner_data.first_name.toUpperCase()} ${learner_data.last_name.toUpperCase()} ${learner_data.surname.toUpperCase()}</td>
                </tr>
                <tr>
                    <td><span class="label">ADM NO:</span> ${learner_data.adm_no}</td>
                </tr>
                <tr>
                    <td><span class="label">CLASS:</span> ${learner_data.stream.grade.name}</td>
                </tr>
                <tr>
                    <td><span class="label">STREAM:</span> ${learner_data.stream.name}</td>
                </tr>
            </table>
        </div>
        <table class="result">
      <col style="width: 25%;" />
    ${school.summative_has_score ? `<col style="width: 10%;" />` : ''}
    <col style="width: 60%;" />
    ${school.summative_has_score ? `<col style="width: 10%;" />` : ''}

            <tr>
                <th>LEARNING AREA</th>
                ${school.summative_has_score ? `<th>SCORE</th>` : ''}
                <th>PERFORMANCE DESCRIPTOR</th>
                ${school.summative_has_pos ? `<th>POS</th>` : ''}
            </tr>
            ${assessments
              .map(
                assessment =>
                  `
                    <tr>
                        <td>${assessment?.learning_area?.name}</td>
                        ${
                          school.summative_has_score
                            ? `<td><b>${assessment.score != 0 ? assessment.score + '%' : '_'}</b></td>`
                            : ''
                        }
                        <td>${assessment.description}</td>
                        ${school.summative_has_pos ? `<td>${assessment.position}</td>` : ''}
                    </tr>
                  `,
              )
              .join('')}
     
        </table>
 <div class="signature-section">
        <div class="comments">
            <div><b>Class Manager's Report:</b></div>
            <p>${teacher_comment?.comment ?? ''}</p>
        </div>
        <div class="signature">
            <img src="${school_stamp}" alt="School Stamp">
            <img src="${signatorySignatureUrl}" alt="Signature">
            <div class="signature-label">${signatoryRole}: ${signatoryName}</div>
        </div>
</div>
    <div class="motto" style="text-align: center; font-style: italic; margin-top: 20px;">
         motto: ${school.school_motto || 'Empowering Learners for a Brighter Future'}
        </div>
</body>
</html>
    `;
    if (!html) {
      return res.status(404).send('HTML content is required');
    }

    // if (herologo && fs.existsSync(herologo)) {
    //   try {
    //     const imageBuffer = fs.readFileSync(herologo);
    //     const base64Image = imageBuffer.toString('base64');

    //     const imageType = 'image/png'; // Adjust based on your image type (e.g., image/jpeg)
    //     herologoDataUrl = `data:${imageType};base64,${base64Image}`;
    //     logger.warn(`<img src="${herologoDataUrl}"  alt="Learner"
    //  style="width:100px;
    //  height:100;
    //         border-radius: 5px;
    //         border: 1px solid black;

    //        ">`);
    //   } catch (error) {
    //     logger.error('Error reading or encoding image file:', error);
    //   }
    // } else {
    //   logger.warn('Image file path is invalid or file does not exist:', 'logo');
    // }

    wkhtmltopdf(html, {
      pageSize: 'A4',
      orientation: 'Portrait', // Optional: change to 'Landscape' if needed
    }).pipe(res);

    // pdf.create(html, options).toBuffer((err, buffer) => {
    //   if (err) {
    //     return res.status(404).send(err.message);
    //   }

    //   res.setHeader('Content-Type', 'application/pdf');
    //   res.setHeader('Content-Disposition', 'attachment; filename=output.pdf');
    //   res.send(buffer);
    // });
  } catch (err) {
    console.log('Error generating PDF:', err);
    logger.error('Error generating PDF:', err.stack);
    res.status(500).json({error: 'Failed to generate PDF', details: err.message});
  }
});
async function getImageDataUrl(filePath) {
  try {
    if (
      filePath &&
      (await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false))
    ) {
      const imageBuffer = await fs.readFile(filePath);
      const base64Image = imageBuffer.toString('base64');
      return `data:image/png;base64,${base64Image}`;
    }
    logger.warn(`Image file not found: ${filePath}`);
    return '';
  } catch (err) {
    logger.warn(`Error reading image file ${filePath}:`, err.message);
    return '';
  }
}
router.get('/attendance/:id', async (req, res) => {
  const {id} = req.params;
  const schoolId = req?.user?.school;

  try {
    const attendanceSummary = await AttendanceService.getLearnerAttendanceById(schoolId, id);
    res.status(200).json({success: true, data: attendanceSummary});
  } catch (error) {
    console.error(`Error retrieving attendance for learner ${id}:`, error);
    res.status(500).json({success: false, message: 'Internal Server Error'});
  }
});
async function generateChartImage(assessments) {
  const brightColors = [
    'rgba(255, 99, 132, 0.9)', // red
    'rgba(54, 162, 235, 0.9)', // blue
    'rgba(255, 206, 86, 0.9)', // yellow
    'rgba(75, 192, 192, 0.9)', // teal
    'rgba(153, 102, 255, 0.9)', // purple
    'rgba(255, 159, 64, 0.9)', // orange
    'rgba(0, 204, 102, 0.9)', // green
  ];

  const borderColors = brightColors.map(color => color.replace('0.9', '1'));

  const configuration = {
    type: 'bar',
    data: {
      labels: assessments.map(a => a.learning_area),
      datasets: assessments[0]?.allTestTypes.map((testType, index) => ({
        label: testType,
        data: assessments.map(assessment => assessment.assessments[index]?.score ?? 0),
        backgroundColor: brightColors[index % brightColors.length],
        borderColor: borderColors[index % borderColors.length],
        borderWidth: 2,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          max: 100,
          grid: {
            color: '#e0e0e0',
          },
          title: {
            display: true,
            text: 'Score',
            font: {
              size: 14,
              weight: 'bold',
            },
          },
        },
        x: {
          grid: {
            display: false,
          },
          title: {
            display: true,
            text: 'Learning Areas',
            font: {
              size: 14,
              weight: 'bold',
            },
          },
          ticks: {
            autoSkip: false,
            maxRotation: 45,
            minRotation: 20,
          },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: {
              size: 12,
            },
          },
        },
        title: {
          display: true,
          text: 'Assessment Scores by Learning Area',
          font: {
            size: 16,
            weight: 'bold',
          },
        },
      },
    },
  };

  const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  return `data:image/png;base64,${imageBuffer.toString('base64')}`;
}
module.exports = router;
