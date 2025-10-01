const logger = require('../../../utils/logger');
const Strand = require('../../../models/cms/content/strand'); // Update the path accordingly
const {validationResult} = require('express-validator');
const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const substrand = require('../../../models/cms/content/substrand');
const LearningArea = require('../../../models/cms/content/learning_area');

// Validation schema using Joi

router.get('/:learning_area/:term', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const {learning_area, term} = req.params;
    if (isNaN(term)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid term format. Term must be a number.',
      });
    }
    if (!mongoose.Types.ObjectId.isValid(learning_area)) {
      return res.status(404).json({
        success: false,
        error: 'Invalid ObjectId format ',
      });
    }
    const searchName = req.query.search || '';

    const query = {
      learning_area,
      term,
      name: {$regex: new RegExp(searchName, 'i')},
    };

    const totalStrands = await Strand.countDocuments(query);
    const total_pages = Math.ceil(totalStrands / limit);

    const strandsList = await Strand.find(query)
      .sort({row_number: 1})
      .skip(skip)
      .limit(limit)
      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({
      success: true,
      data: strandsList,
      pagination: {
        current_page: page,
        total: totalStrands,
        total_pages: total_pages,
        per_page: limit,
      },
      search: searchName,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

// List All Strands (without filters)
router.get('/all', async (req, res) => {
  try {
    const strandsList = await Strand.find()
      .sort({row_number: -1})

      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({success: true, data: strandsList});
  } catch (error) {
    logger.error(`Failed to fetch strands: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;

    const {learning_area, term} = req.query;

    const query = {learning_area, term};

    const totalStrands = await Strand.countDocuments(query);
    const total_pages = Math.ceil(totalStrands / PAGE_SIZE);

    const strandsList = await Strand.find(query)
      .sort({row_number: -1})

      .skip(skip)
      .limit(PAGE_SIZE)
      .populate({
        path: 'learning_area',
        select: 'name',
        populate: {
          path: 'grade_id',
          select: 'name',
        },
      });

    res.status(200).json({
      success: true,
      data: strandsList,
      pagination: {
        current_page: page,
        total: totalStrands,
        total_pages: total_pages,
        per_page: PAGE_SIZE,
      },
    });
  } catch (error) {
    logger.error(`Failed to fetch strands: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});
router.get('/scheme/learning-areas/:learningAreaId', async (req, res) => {
  try {
    const {learningAreaId} = req.params;

    // Validate learningAreaId
    if (!mongoose.Types.ObjectId.isValid(learningAreaId)) {
      return res.status(400).json({message: 'Invalid learning area ID'});
    }

    // Fetch the learning area
    const learningArea = await LearningArea.findById(learningAreaId).select('name _id').lean();

    if (!learningArea) {
      return res.status(404).json({message: 'Learning area not found'});
    }

    // Fetch strands for the learning area
    const strands = await Strand.find({learning_area: learningAreaId}).select('name _id').lean();

    // Fetch substrands for each strand
    const strandsWithSubstrands = await Promise.all(
      strands.map(async strand => {
        const substrands = await substrand.find({strand: strand._id}).select('name _id').lean();
        return {
          _id: strand._id,
          name: strand.name,
          substrands,
        };
      }),
    );

    // Construct the response
    const result = {
      _id: learningArea._id,
      name: learningArea.name,
      strands: strandsWithSubstrands,
    };

    res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching learning area:', error);
    res.status(500).json({message: 'Server error'});
  }
});
module.exports = router;
