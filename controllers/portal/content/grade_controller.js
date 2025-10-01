const logger = require('../../../utils/logger');
const Grade = require('../../../models/cms/content/grade');
const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GradeUserAssignment = require('../../../models/portal/content/grade_teacher_asigment');
const LearningArea = require('../../../models/cms/content/learning_area');
const Stream = require('../../../models/portal/content/Stream');
// Validation schema using Joi
// const gradeSchema = Joi.object({
//   level_id: Joi.string().required(),
//   name: Joi.string().required(),
// });

// List Grades
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit);
    const attendance = parseInt(req.query.attendance);

    const skip = (page - 1) * limit;
    const grade = await Stream.find({
      school: req.user.school._id,
      $or: [{class_manager: req.user._id}, {section_head: req.user._id}],
    }).select('grade');
    const greadIds_manager = grade.map(g => g.grade);

    if (req.user.teacher) {
      const distinctLearningAreaIds = await GradeUserAssignment.distinct('learning_area', {user: req.user.teacher});

      // Step 2: Populate learning area details and fetch grades associated with these learning areas
      const distinctLearningAreas = await LearningArea.find({
        _id: {$in: distinctLearningAreaIds},
      }).populate('grade_id', 'name'); // Assuming 'grade_id' is the field in LearningArea model that refers to Grade

      // Extract grade IDs from learning areas
      const gradeIds = distinctLearningAreas.map(area => area.grade_id._id);
      const allGrades = greadIds_manager.concat(gradeIds);
      console.log(allGrades);
      const query = {name: {$regex: new RegExp(search, 'i')}};
      query._id = {$in: allGrades};
      // Step 3: Fetch all grades associated with the learning areas
      const assignedGrades = await Grade.find(query).select('name'); // Adjust the field names according to your schema

      return res.status(200).json({
        success: true,
        data: assignedGrades,
      });
    }
    const query = {name: {$regex: new RegExp(search, 'i')}};

    const totalGrades = await Grade.countDocuments(query);
    const total_pages = Math.ceil(totalGrades / limit);
    let gradesList = [];
    if (!limit) {
      gradesList = await Grade.aggregate([
        {$sort: {level: 1}}, // Sort by level in ascending order
        {
          $lookup: {
            from: 'streams', // The name of the Stream collection
            let: {gradeId: '$_id', school: req.school._id}, // Pass both gradeId and school as variables
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      {$eq: ['$grade', '$$gradeId']}, // Match Stream.grade to Grade._id
                      {$eq: ['$school', '$$school']}, // Match Stream.school to yourschool
                    ],
                  },
                },
              },
            ],
            as: 'streams', // Name of the array to store related streams
          },
        },
      ]);
    } else {
      gradesList = await Grade.find(query).sort({level: 1}).populate('level_id', 'name');
    }
    return res.status(200).json({
      success: true,
      data: gradesList,
      pagination: {
        current_page: page,
        total: totalGrades,
        total_pages: 1,
        per_page: total_pages,
      },
      search: search,
      limit: limit,
    });
  } catch (error) {
    console.log(error);
    logger.error(`Failed to fetch grades: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

module.exports = router;
