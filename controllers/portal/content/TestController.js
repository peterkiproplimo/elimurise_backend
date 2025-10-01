const express = require('express');
const router = express.Router();
const testService = require('../../../services/portal/TestService'); // Adjust the path as necessary
const Joi = require('joi');
const {checkPermission} = require('../../../middleware/portal-auth');
const Test = require('../../../models/portal/content/Test');
const mongoose = require('mongoose');
const Learner = require('../../../models/portal/content/Learner');
const SummativeAssessment = require('../../../models/portal/content/SummativeAssessment');
const summativeAssessment = require('../../../services/portal/SummativeAssessmentService'); // Adjust the path as necessary

const testSchema = Joi.object({
  name: Joi.string().required(),
  type: Joi.string().required(),
  term: Joi.string().required(),
  grade: Joi.string().required(),
  grading: Joi.string().required(),
});

const validateTest = (req, res, next) => {
  const {error} = testSchema.validate(req.body);
  if (error) {
    return res.status(404).json({error: error.details[0].message});
  }
  next();
};

// Set publish status for all assessments of a test
router.patch('/:id/publish', async (req, res) => {
  try {
    const testId = req.params.id;

    // Fetch the current test (you need to adjust this to your actual DB logic)
    const test = await testService.getTestByIdOnly(testId); // <-- replace with your DB function

    if (!test) {
      return res.status(404).json({success: false, error: 'Test not found'});
    }

    // Toggle publish status
    // const newPublishStatus = !test.publish;

    // Update publish status
    const result = await testService.setTestPublishStatus(test._id);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error(error);
    if (error.message === 'Test not found' || error.message === 'No assessments found for this test') {
      return res.status(404).json({success: false, error: error.message});
    }
    return res.status(500).json({success: false, error: 'Internal Server Error', message: error.message});
  }
});

// Create a new test
router.post('/', checkPermission('tests', 'create'), async (req, res) => {
  try {
    let current_session = req?.current_session;
    let school = req.school._id;

    const test = await testService.createTest({...req.body, school, session: current_session});

    return res.status(200).json({success: true, data: test, message: 'Test created successifully'});
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

// Get all tests
// router.get('/', checkPermission('tests', 'read'), async (req, res) => {
//   try {
//     const filters = {name: {$regex: new RegExp(req.query.search, 'i')}};

//     if (req.query.grade) filters.grade = req.query.grade;
//     if (req.query.term) filters.term = req.query.term;
//     if (req.query.type) filters.type = req.query.type;
//     filters.session = req?.current_session;
//     filters.$or = [{school: req?.school}, {school: null}];
//     console.log(filters);
//     const tests = await testService.getTests(filters);

//     res.status(200).json({success: true, data: tests});
//   } catch (error) {
//     res.status(404).json({success: false, error: error.message});
//   }
// });
router.get('/', checkPermission('tests', 'read'), async (req, res) => {
  try {
    // Build filters dynamically from query parameters
    const filters = {};
    if (req.query.grade) filters.grade = new mongoose.Types.ObjectId(req.query.grade);
    if (req.query.term) filters.term = req.query.term;
    if (req.query.type) filters.type = req.query.type;

    filters.$or = [{school: req?.school}, {school: null}];
    // Search query
    if (req.query.search) {
      const searchRegex = new RegExp(req.query.search, 'i'); // Case-insensitive search
      filters.$or = [
        {name: searchRegex}, // Adjust 'name' to the field(s) you want to search
        {description: searchRegex}, // Example: if your model has a 'description' field
      ];
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1; // Default to page 1
    const limit = req.query.limit ? parseInt(req.query.limit) : null;
    const skip = limit ? (page - 1) * limit : 0;

    // Aggregation pipeline
    const aggregationPipeline = [
      // Stage 1: Apply filters
      {
        $match: filters, // Use validated filters
      },
      // Stage 2: Lookup gradesn
      {
        $lookup: {
          from: 'grades', // Verify collection name
          localField: 'grade', // Ensure this field exists
          foreignField: '_id', // ObjectId in grades
          as: 'grade', // Output array
        },
      },
      // Stage 3: Unwind grade
      {
        $unwind: {
          path: '$grade',
          preserveNullAndEmptyArrays: true, // Retain documents without grade
        },
      },
      // Stage 4: Lookup grading scales
      {
        $lookup: {
          from: 'plscales', // Verify collection name
          localField: 'grading', // Ensure this field exists
          foreignField: '_id', // ObjectId in plscales
          as: 'grading', // Output array
        },
      },
      // Stage 5: Unwind grading
      {
        $unwind: {
          path: '$grading',
          preserveNullAndEmptyArrays: true, // Retain documents without grading
        },
      },
      // Stage 6: Sort results
      {
        $sort: {
          session: 1, // Ascending sort
          'grade.level': 1, // Ascending sort
        },
      },
    ];

    // Conditionally add pagination stages
    if (limit) {
      aggregationPipeline.push({$skip: skip}, {$limit: limit});
    }

    // Execute aggregation
    const tests = await Test.aggregate(aggregationPipeline);

    // Total count for pagination
    const totalTests = await Test.countDocuments(filters);
    const totalPages = limit ? Math.ceil(totalTests / limit) : 1;

    res.status(200).json({
      success: true,
      data: tests,
      pagination: limit
        ? {
            current_page: page,
            total: totalTests,
            total_pages: totalPages,
            per_page: limit,
          }
        : null, // Return null if no pagination is applied
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});
router.get('/assessed-tests', async (req, res) => {
  try {
    const filters = {};
    filters.session = req.current_session;
    const schoolId = req?.school; // Ensure the logged-in user belongs to a school
    const {stream, test} = req.query;

    // Apply filters based on query parameters
    // if (req.query.type) filters.type = req.query.type;
    // filters.$or = [{school: schoolId}, {school: null}];
    const testData = await Test.findOne({_id: test});
    const grade = stream ? undefined : testData.grade;

    const {data, learningAreaStats} = await summativeAssessment.generateBroadsheet(
      schoolId,
      grade,
      stream == '' ? undefined : stream,
      testData.term,
      test,
      req.current_session,
    );

    const subjects = Array.from(new Set(data.flatMap(item => Object.keys(item.assessments))));

    // Fetch the tests for the given school and filters

    // For each test, calculate the number of learners assessed and the percentage

    res.status(200).json({
      data: data,
      subjects,
      message: 'Successfully retrieved assessed tests and learner percentages',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({error: error.message});
  }
});

// Get a single test by ID
router.get('/:id', checkPermission('tests', 'read'), async (req, res) => {
  try {
    const test = await testService.getTestById(req.params.id);
    if (!test) {
      return res.status(404).json({success: false, error: 'Test not found'});
    }
    res.status(200).json({success: true, data: test});
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

// Update a test by ID
router.put('/:id', checkPermission('tests', 'update'), async (req, res) => {
  try {
    let school = req.school._id;

    const test = await testService.updateTest(req.params.id, req.body, school);
    if (!test) {
      return res.status(404).json({error: 'Test not found'});
    }
    return res.status(200).json({success: true, data: test, message: 'Test updated successifully'});
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

// Delete a test by ID
router.delete('/:id', checkPermission('tests', 'delete'), async (req, res) => {
  try {
    let current_session = req?.current_session;
    let school = req.school._id;

    const test = await testService.deleteTest(req.params.id, school);
    if (!test) {
      return res.status(404).json({error: 'Test not found'});
    }
    res.status(200).json({message: 'Test deleted successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
