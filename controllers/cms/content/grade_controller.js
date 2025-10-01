const logger = require('../../../utils/logger');
const Grade = require('../../../models/cms/content/grade');
const PAGE_SIZE = 100;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GradeUserAssignment = require('../../../models/cms/auth/grade_user_asigment');
const LearningArea = require('../../../models/cms/content/learning_area');

// Validation schema using Joi
// const gradeSchema = Joi.object({
//   level_id: Joi.string().required(),
//   name: Joi.string().required(),
// });

// Create Grade
router.post('/', async (req, res) => {
  try {
    // const { error } = gradeSchema.validate(req.body);
    // if (error) {
    //   return res.status(404).json({ error: error.details[0].message });
    // }
    const {name, level_id, level} = req.body;
    const newGrade = await Grade.create({name, level_id, level});
    return res.status(201).json({success: true, data: newGrade, message: 'Created Successfully'});
  } catch (err) {
    logger.error(`Error creating grade: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to save duplicate entry'});
  }
});

// Update Grade
router.put('/', async (req, res) => {
  try {
    // const { error } = gradeSchema.validate(req.body);
    // if (error) {
    //   return res.status(404).json({ error: error.details[0].message });
    // }

    const {level_id, name, _id, level} = req.body;

    const updatedGrade = await Grade.findByIdAndUpdate(_id, {level_id, name, level}, {new: true});

    if (!updatedGrade) {
      return res.status(404).json({message: 'Grade not found'});
    }

    return res.status(200).json({success: true, data: updatedGrade, message: 'Updated Successfully'});
  } catch (error) {
    logger.error(`Failed to update grade: ${error.message}`);
    return res.status(404).json({success: false, message: 'Internal server error'});
  }
});

// List Grades

router.get('/', async (req, res) => {
  try {
    const superAdmin = await req.superAdmin;

    if (!superAdmin) {
      const distinctLearningAreaIds = await GradeUserAssignment.distinct('grade', {user: req.user._id});

      // Step 2: Populate learning_area details
      const distinctLearningAreas = await Grade.find({
        _id: {$in: distinctLearningAreaIds},
      }).populate('level_id', 'name');
      return res.status(200).json({
        success: true,
        data: distinctLearningAreas,
        pagination: {
          current_page: 0,
          total: 0,
          total_pages: 0,
          per_page: 0,
        },
        search: '',
        limit: 1,
      });
    }
    const page = parseInt(req.query.page) || 1;

    const search = req.query.search || '';
    const level = req.query.level;

    const limit = parseInt(req.query.limit) || PAGE_SIZE;
    const skip = (page - 1) * limit;

    const query = {name: {$regex: new RegExp(search, 'i')}};
    if (level) {
      query.level_id = level;
    }
    const totalGrades = await Grade.countDocuments(query);
    const total_pages = Math.ceil(totalGrades / limit);
    console.log(page);
    const gradesList = await Grade.find(query)
      .sort({level: 1}) // 1 for ascending order, -1 for descending order
      .skip(skip)
      .limit(limit)
      .populate('level_id', 'name');

    res.status(200).json({
      success: true,
      data: gradesList,
      pagination: {
        current_page: page,
        total: totalGrades,
        total_pages: total_pages,
        per_page: limit,
      },
      search: search,
      limit: limit,
    });
  } catch (error) {
    logger.error(`Failed to fetch grades: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

// Delete Grade
router.delete('/:gradeId', async (req, res) => {
  try {
    const {gradeId} = req.params;
    const leaningArea = await LearningArea.find({grade_id: gradeId});
    if (leaningArea.length > 0) {
      return res.status(404).json({
        success: false,

        message: 'Cannot delete, Linked to a Learning Area',
      });
    }
    const deletedGrade = await Grade.findOneAndDelete({_id: gradeId});

    if (deletedGrade) {
      return res.status(200).json({
        success: true,
        data: deletedGrade,
        message: 'Deleted Successfully',
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete grade: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

module.exports = router;
