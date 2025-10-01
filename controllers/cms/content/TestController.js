const express = require('express');
const router = express.Router();
const testService = require('../../../services/portal/TestService'); // Adjust the path as necessary
const Joi = require('joi');
const Test = require('../../../models/portal/content/Test');
const mongoose = require('mongoose');

const testSchema = Joi.object({
  term: Joi.string().required(),

  type: Joi.string().required(),
  name: Joi.string().required(),
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

// Create a new test
router.post('/', validateTest, async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();

    const test = await testService.createTest({...req.body, session: currentYear});
    res.status(200).json({success: true, data: test, message: 'Test created successfully'});
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

// Get all tests
// router.get('/', async (req, res) => {
//   try {
//     // Build filters dynamically from query parameters
//     const filters = {};
//     if (req.query.grade) filters.grade = req.query.grade;
//     if (req.query.term) filters.term = req.query.term;
//     if (req.query.type) filters.type = req.query.type;

//     filters.school = null;

//     // Search query
//     if (req.query.search) {
//       const searchRegex = new RegExp(req.query.search, 'i'); // Case-insensitive search
//       filters.$or = [
//         {name: searchRegex}, // Adjust 'name' to the field(s) you want to search
//       ];
//     }

//     console.log(filters);

//     // Pagination parameters
//     const page = parseInt(req.query.page) || 1; // Default to page 1
//     const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
//     const skip = (page - 1) * limit;

//     // Fetch tests with filters, pagination, and population
//     const tests = await Test.find(filters)
//       .skip(skip)
//       .limit(limit)
//       .populate('session')
//       .populate('term')
//       .populate('grade');

//     // Total count for pagination
//     const totalTests = await Test.countDocuments(filters);
//     const totalPages = Math.ceil(totalTests / limit);

//     res.status(200).json({
//       success: true,
//       data: tests,
//       pagination: {
//         current_page: page,
//         total: totalTests,
//         total_pages: totalPages,
//         per_page: limit,
//       },
//     });
//   } catch (error) {
//     console.error(error);
//     res.status(500).json({
//       success: false,
//       error: error.message,
//     });
//   }
// });
router.get('/', async (req, res) => {
  try {
    // Build filters dynamically from query parameters
    const filters = {};
    if (req.query.grade) filters.grade = new mongoose.Types.ObjectId(req.query.grade);
    if (req.query.term) filters.term = req.query.term;
    if (req.query.type) filters.type = req.query.type;

    filters.school = null;

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
    const limit = parseInt(req.query.limit) || 10; // Default to 10 items per page
    const skip = (page - 1) * limit;

    // Aggregation pipeline
    const aggregationPipeline = [
      {$match: filters}, // Apply filters
      {
        $lookup: {
          from: 'grades', // Collection name of the Grade model
          localField: 'grade',
          foreignField: '_id',
          as: 'grade',
        },
      },
      {$unwind: '$grade'}, // Flatten the populated grade field
      {
        $sort: {
          session: 1, // Sort by session (text field in Test)
          'grade.level': 1, // Sort by level inside grade
        },
      },
      {$skip: skip}, // Apply pagination skip
      {$limit: limit}, // Apply pagination limit
    ];

    // Execute aggregation
    const tests = await Test.aggregate(aggregationPipeline);

    // Total count for pagination
    const totalTests = await Test.countDocuments(filters);
    const totalPages = Math.ceil(totalTests / limit);

    res.status(200).json({
      success: true,
      data: tests,
      pagination: {
        current_page: page,
        total: totalTests,
        total_pages: totalPages,
        per_page: limit,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get a single test by ID
router.get('/:id', async (req, res) => {
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
router.put('/:id', async (req, res) => {
  try {
    const test = await testService.updateTest(req.params.id, req.body);
    if (!test) {
      return res.status(404).json({error: 'Test not found'});
    }
    return res.status(200).json({success: true, data: test, message: 'Test updated successfully'});
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});

// Delete a test by ID
router.delete('/:id', async (req, res) => {
  try {
    const test = await testService.deleteTestAdmin(req.params.id);
    if (!test) {
      return res.status(404).json({error: 'Test not found'});
    }
    res.status(200).json({message: 'Test deleted successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
