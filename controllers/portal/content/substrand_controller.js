const express = require('express');
const router = express.Router();
const logger = require('../../../utils/logger');
const Substrand = require('../../../models/cms/content/substrand');
const {validationResult} = require('express-validator');
const mongoose = require('mongoose');
const LessonProgressService = require('../../../services/portal/AsessmentProgress');

const PAGE_SIZE = 10;

router.get('/byStrand/:strandId', async (req, res) => {
  try {
    const strandId = req.params.strandId;
    if (!mongoose.Types.ObjectId.isValid(strandId)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid ObjectId format for strandId',
      });
    }
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const searchName = req.query.search || '';
    const query = {
      strand: strandId,
      name: {$regex: new RegExp(searchName, 'i')},
    };

    const totalSubstrands = await Substrand.countDocuments(query);
    const total_pages = Math.ceil(totalSubstrands / limit);

    const substrands = await Substrand.find(query)
      .sort({name: 1})

      .populate({
        path: 'strand',
        populate: {
          path: 'learning_area',
          populate: {
            path: 'grade_id',
          },
        },
      })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      data: substrands,
      pagination: {
        current_page: page,
        total: totalSubstrands,
        total_pages: total_pages,
        per_page: limit,
      },
      search: searchName,
    });
  } catch (error) {
    res.status(404).json({
      success: false,
      error: 'Internal Server Error',
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;

    const searchName = req.query.name || '';
    const query = {name: {$regex: new RegExp(searchName, 'i')}};

    const substrandsList = await Substrand.find(query)

      .skip(skip)
      .limit(PAGE_SIZE)
      .populate('strand', 'name');

    const totalSubstrands = await Substrand.countDocuments(query);
    const total_pages = Math.ceil(totalSubstrands / PAGE_SIZE);

    res.status(200).json({
      success: true,
      data: substrandsList,
      pagination: {
        current_page: page,
        total: totalSubstrands,
        total_pages: total_pages,
        per_page: PAGE_SIZE,
      },
      search: searchName,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.get('/:stream/:id', async (req, res) => {
  try {
    // const limit = parseInt(req.query.page) || 1;
    // const skip = (page - 1) * PAGE_SIZE;
    const substrand = req.params.id;
    const stream = req.params.stream;
    // const searchName = req.query.name || '';
    // const query = {name: {$regex: new RegExp(searchName, 'i')}};

    const substrandsList = await Substrand.findById(substrand)
      // .skip(skip)
      // .limit(PAGE_SIZE)
      .sort({name: 1})
      .populate({
        path: 'strand',
        populate: {
          path: 'learning_area',
          populate: {
            path: 'grade_id',
          },
        },
      });

    // Ensure LessonProgressService.getProgresses is async if it involves I/O operations
    const computed = await Promise.all(
      substrandsList.indicators.map(async indicatorGroup => {
        // Assuming indicatorGroup is an array and we need the first indicator
        const indicator = indicatorGroup[0];
        const indicatorId = indicator._id;
        let school = req?.user?.school._id;
        let session = req?.current_session;
        // Ensure stream is available in the request

        // Retrieve progress data
        const {number_of_learners_assessed, number_of_learners, most_used_method} =
          await LessonProgressService.getProgresses(school, stream, session, indicatorId);

        return [
          {
            ...indicator.toObject(),
            total_learners: number_of_learners,
            total_learners_assessed: number_of_learners_assessed,
            method: most_used_method,
          },
        ];
      }),
    );

    // const totalSubstrands = await Substrand.countDocuments(query);
    // const total_pages = Math.ceil(totalSubstrands / PAGE_SIZE);
    const substrandUpdated = {...substrandsList.toObject(), indicators: computed};
    res.status(200).json({
      success: true,
      data: substrandUpdated,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
// Call the function to update row numbers

module.exports = router;
