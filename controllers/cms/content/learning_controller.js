const LearningArea = require('../../../models/cms/content/learning_area');
const logger = require('../../../utils/logger');
const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GradeUserAssignment = require('../../../models/cms/auth/grade_user_asigment');
const Strand = require('../../../models/cms/content/strand');

// Validation schema using Joi

// Create Learning Area
router.post('/', async (req, res) => {
  try {
    // console.log({name, short_name, grade_id});
    const {name, short_name, grade_id, no_of_lessons_per_week, is_compulsory} = req.body;
    const newLearningArea = await LearningArea.create({name, grade_id, short_name, no_of_lessons_per_week, is_compulsory});
    console.log(newLearningArea);
    return res.status(201).json({
      success: true,
      data: newLearningArea,
      message: 'Created Successfully',
    });
  } catch (err) {
    logger.error(`Error creating learning area: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to save' + err.message});
  }
});

// Update Learning Area
router.put('/:id', async (req, res) => {
  try {
    const {id} = req.params;

    const {name, grade_id, short_name, no_of_lessons_per_week, is_compulsory} = req.body;

    const updatedLearningArea = await LearningArea.findByIdAndUpdate(
      id,
      {name, grade_id, short_name, no_of_lessons_per_week, is_compulsory },
      {new: true},
    );

    if (!updatedLearningArea) {
      return res.status(404).json({success: false, message: 'Learning area not found'});
    }

    return res.status(200).json({
      success: true,
      data: updatedLearningArea,
      message: 'Learning area updated successfully',
    });
  } catch (err) {
    logger.error(`Error updating learning area: ${err.message}`);
    return res.status(404).json({success: false, message: 'Failed to update'});
  }
});

// List Learning Areas

router.get('/', async (req, res) => {
  try {
    const superAdmin = req.superAdmin; // assuming req.superAdmin is a boolean
    const PAGE_SIZE = 10; // or any default page size

    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || PAGE_SIZE;
    const gradeId = req.query.gradeId;

    if (!superAdmin) {
      // Filter GradeUserAssignment by user ID and gradeId if provided
      const gradeUserAssignmentQuery = {user: req.user._id};
      if (gradeId) {
        gradeUserAssignmentQuery.grade_id = gradeId;
      }

      const distinctLearningAreaIds = await GradeUserAssignment.distinct('learning_area', gradeUserAssignmentQuery);

      // Populate learning_area details
      const query = {_id: {$in: distinctLearningAreaIds}};
      if (search) {
        query.name = {$regex: new RegExp(search, 'i')};
      }

      const totalLearningAreas = await LearningArea.countDocuments(query);
      const total_pages = Math.ceil(totalLearningAreas / limit);

      const distinctLearningAreas = await LearningArea.find(query)
        .sort({createdAt: -1})
        .skip(skip)
        .limit(limit)
        .populate('grade_id', 'name');

      return res.status(200).json({
        success: true,
        data: distinctLearningAreas,
        dd: 'ss',
        pagination: {
          current_page: page,
          total: totalLearningAreas,
          total_pages: total_pages,
          per_page: limit,
        },
        search: search,
        limit: limit,
      });
    }

    // Super admin query
    const query = {name: {$regex: new RegExp(search, 'i')}};

    // Add gradeId filter if provided
    if (gradeId) {
      query.grade_id = gradeId;
    }

    const totalLearningAreas = await LearningArea.countDocuments(query);
    const total_pages = Math.ceil(totalLearningAreas / limit);

    const learningAreasList = await LearningArea.find(query)
      .sort({createdAt: -1})
      .skip(skip)
      .limit(limit)
      .populate('grade_id', 'name');

    res.status(200).json({
      success: true,
      data: learningAreasList,
      pagination: {
        current_page: page,
        total: totalLearningAreas,
        total_pages: total_pages,
        per_page: limit,
      },
      search: search,
      limit: limit,
    });
  } catch (error) {
    logger.error(`Failed to fetch learning areas: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

// Delete Learning Area
router.delete('/:learningAreaId', async (req, res) => {
  try {
    const {learningAreaId} = req.params;
    const strand = await Strand.find({learning_area: learningAreaId});
    if (strand.length > 0) {
      return res.status(404).json({
        success: false,
        data: strand,
        message: 'Cannot delete, Linked to a Strand !',
      });
    }
    const deletedLearningArea = await LearningArea.findOneAndDelete({
      _id: learningAreaId,
    });
    if (deletedLearningArea) {
      return res.status(200).json({
        success: true,
        data: deletedLearningArea,
        message: 'Deleted Successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete learning area: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

module.exports = router;
