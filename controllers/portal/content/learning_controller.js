const LearningArea = require('../../../models/cms/content/learning_area');
const SchoolLearningAreaAssignment = require('../../../models/portal/content/school_learning_area_assignment');
const logger = require('../../../utils/logger');
const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const GradeUserAssignment = require('../../../models/portal/content/grade_teacher_asigment');
const {checkPermission} = require('../../../middleware/portal-auth');
const Stream = require('../../../models/portal/content/Stream');

// Validation schema using Joi
const createLearningAreaSchema = Joi.object({
  name: Joi.string().required(),
  short_name: Joi.string().required(),
  grade_id: Joi.string().required(),
  no_of_lessons_per_week: Joi.number().min(0).required(),
});

// Create Learning Area for School
router.post('/', checkPermission('learning-areas', 'create'), async (req, res) => {
  try {
    const {error, value} = createLearningAreaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({success: false, message: error.details[0].message});
    }

    const {name, short_name, grade_id, no_of_lessons_per_week, is_compulsory} = value;

    // Check if learning area with same name already exists for this school and grade
    const existingLearningArea = await LearningArea.findOne({
      name: name,
      grade_id: grade_id,
    });

    if (existingLearningArea) {
      return res.status(400).json({
        success: false,
        message: `Learning area "${name}" already exists for this grade in your school.`,
      });
    }

    const newLearningArea = await LearningArea.create({
      name,
      short_name,
      grade_id,
      no_of_lessons_per_week,
      is_compulsory: is_compulsory,
    });

    return res.status(201).json({
      success: true,
      data: newLearningArea,
      message: 'Learning area created successfully',
    });
  } catch (err) {
    logger.error(`Error creating learning area: ${err.message}`);
    res.status(500).json({success: false, message: 'Failed to create learning area: ' + err.message});
  }
});

// Update Learning Area for School
router.put('/:id', checkPermission('learning-areas', 'update'), async (req, res) => {
  try {
    const {id} = req.params;
    const {error, value} = createLearningAreaSchema.validate(req.body);
    if (error) {
      return res.status(400).json({success: false, message: error.details[0].message});
    }

    const {name, short_name, grade_id, no_of_lessons_per_week, is_compulsory} = value;

    // Check if learning area belongs to the school
    const existingLearningArea = await LearningArea.findOne({
      _id: id,
    });

    if (!existingLearningArea) {
      return res.status(404).json({success: false, message: 'Learning area not found or not accessible'});
    }

    // Check if name already exists for this school and grade (excluding current learning area)
    const duplicateLearningArea = await LearningArea.findOne({
      name: name,
      grade_id: grade_id,
      _id: {$ne: id},
    });

    if (duplicateLearningArea) {
      return res.status(400).json({
        success: false,
        message: `Learning area "${name}" already exists for this grade in your school.`,
      });
    }

    const updatedLearningArea = await LearningArea.findByIdAndUpdate(
      id,
      {name, short_name, grade_id, no_of_lessons_per_week, is_compulsory},
      {new: true},
    );

    return res.status(200).json({
      success: true,
      data: updatedLearningArea,
      message: 'Learning area updated successfully',
    });
  } catch (err) {
    logger.error(`Error updating learning area: ${err.message}`);
    return res.status(500).json({success: false, message: 'Failed to update learning area'});
  }
});

// Delete Learning Area for School
router.delete('/:id', checkPermission('learning-areas', 'delete'), async (req, res) => {
  try {
    const {id} = req.params;

    // Check if learning area belongs to the school
    const learningArea = await LearningArea.findOne({
      _id: id,
    });

    if (!learningArea) {
      return res.status(404).json({success: false, message: 'Learning area not found or not accessible'});
    }

    // Check if it's a global learning area (schools can't delete global ones)
    if (learningArea.is_compulsory) {
      return res.status(403).json({success: false, message: 'Cannot delete system-wide learning areas'});
    }

    const deletedLearningArea = await LearningArea.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      data: deletedLearningArea,
      message: 'Learning area deleted successfully',
    });
  } catch (err) {
    logger.error(`Error deleting learning area: ${err.message}`);
    return res.status(500).json({success: false, message: 'Failed to delete learning area'});
  }
});

// List Learning Areas

router.get('/', checkPermission('learning-areas', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * PAGE_SIZE;
    const search = req.query.search || '';
    const limit = parseInt(req.query.limit) || 0; // If no limit, return all
    const gradeId = req.query.gradeId;

    // Get school learning area assignments for this school
    let schoolLearningAreaAssignments = await SchoolLearningAreaAssignment.find({
      school: req.user.school._id,
    }).populate('learning_area');

    const learningAreaIds = schoolLearningAreaAssignments.map(assignment => assignment.learning_area._id);
    const assignmentMap = new Map();
    schoolLearningAreaAssignments.forEach(assignment => {
      assignmentMap.set(assignment.learning_area._id.toString(), assignment);
    });

    if (req.user.teacher) {
      // Get distinct learning area IDs
      const distinctLearningAreaIds = await GradeUserAssignment.distinct('learning_area', {
        user: req.user.teacher,
      });

      // Get grades assigned through streams where teacher is class manager
      const grades_assigned = await Stream.find({
        school: req.user.school._id,
        $or: [{class_manager: req.user._id}, {section_head: req.user._id}],
      }).select('_id grade'); // Assuming 'grade' is the field name in Stream model

      // Extract grade IDs from assigned streams
      const gradeIds = grades_assigned.map(stream => stream.grade);

      // Build query for teacher - combine compulsory and school-specific learning areas
      const query = {
        name: {$regex: new RegExp(search, 'i')},
        $or: [
          {is_compulsory: true}, // Include global learning areas
          {_id: {$in: learningAreaIds}}, // Include school-specific learning areas
          {_id: {$in: distinctLearningAreaIds}}, // Include teacher's assigned learning areas
          {grade_id: {$in: gradeIds}}, // Include learning areas for teacher's grades
        ],
      };

      // Override with specific gradeId if provided
      if (gradeId) {
        query.grade_id = gradeId;
      }

      // Fetch learning areas with grade details
      const distinctLearningAreas = await LearningArea.find(query).sort({name: 1}).populate('grade_id', 'name');

      // Add metadata to each learning area
      const learningAreasWithMetadata = distinctLearningAreas.map(la => {
        const assignment = assignmentMap.get(la._id.toString());
        return {
          ...la.toObject(),
          is_optional: !la.is_compulsory,
          is_school_assigned: !!assignment,
          assignment_id: assignment?._id || null,
          can_remove: !la.is_compulsory && !!assignment, // Can remove if not compulsory and has assignment
        };
      });

      return res.status(200).json({
        success: true,
        data: learningAreasWithMetadata,
        pagination: {
          current_page: 0,
          total: learningAreasWithMetadata.length,
          total_pages: 1,
          per_page: learningAreasWithMetadata.length,
        },
        search: search || '',
        limit: 1,
      });
    }

    // For non-teachers (admins), show both global and school-specific learning areas
    // First, get all learning areas that should be included
    let allLearningAreaIds = new Set();

    // Add compulsory learning areas
    const compulsoryLearningAreas = await LearningArea.find({is_compulsory: true});
    compulsoryLearningAreas.forEach(la => allLearningAreaIds.add(la._id.toString()));

    // Add school-specific learning areas
    learningAreaIds.forEach(id => allLearningAreaIds.add(id.toString()));

    // Convert back to array
    const finalLearningAreaIds = Array.from(allLearningAreaIds);

    // Build the main query
    const query = {
      name: {$regex: new RegExp(search, 'i')},
      _id: {$in: finalLearningAreaIds},
    };
    if (gradeId) {
      // If gradeId is provided, filter by the learning area's grade_id
      query.grade_id = gradeId;
    }

    // Add gradeId filter if provided

    // Get the total count of matching documents
    const totalLearningAreas = await LearningArea.countDocuments(query);

    // Calculate total pages (if limit is provided and greater than 0)
    const total_pages = limit > 0 ? Math.ceil(totalLearningAreas / limit) : 1;

    const learningAreasList = await LearningArea.find(query)
      .sort({createdAt: -1})
      .skip(limit > 0 ? skip : 0) // Only skip if there is a limit
      .limit(limit > 0 ? limit : totalLearningAreas) // If no limit, return all
      .populate('grade_id', 'name');

    // Add metadata to each learning area
    const learningAreasWithMetadata = learningAreasList.map(la => {
      const assignment = assignmentMap.get(la._id.toString());
      return {
        ...la.toObject(),
        is_optional: !la.is_compulsory,
        is_school_assigned: !!assignment,
        assignment_id: assignment?._id || null,
        can_remove: !la.is_compulsory && !!assignment, // Can remove if not compulsory and has assignment
      };
    });

    return res.status(200).json({
      success: true,
      data: learningAreasWithMetadata,
      pagination: {
        current_page: page,
        total: totalLearningAreas,
        total_pages: total_pages,
        per_page: limit > 0 ? limit : totalLearningAreas,
      },
      search: search,
      limit: limit,
    });
  } catch (error) {
    logger.error(`Failed to fetch learning areas: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

// Remove School Learning Area Assignment
router.delete('/assignment/:assignmentId', checkPermission('learning-areas', 'delete'), async (req, res) => {
  try {
    const {assignmentId} = req.params;
    const schoolId = req.user.school._id;

    // Find the assignment
    const assignment = await SchoolLearningAreaAssignment.findOne({
      _id: assignmentId,
      school: schoolId,
    }).populate('learning_area');

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Learning area assignment not found',
      });
    }

    // Check if the learning area is compulsory (cannot remove compulsory learning areas)
    if (assignment.learning_area.is_compulsory) {
      return res.status(403).json({
        success: false,
        message: 'Cannot remove compulsory learning areas',
      });
    }

    // TODO: Add transaction check here when transaction models are available
    // For now, we'll allow removal but you can add this validation later:
    // const hasTransactions = await Transaction.countDocuments({
    //   school: schoolId,
    //   learning_area: assignment.learning_area._id
    // });
    // if (hasTransactions > 0) {
    //   return res.status(403).json({
    //     success: false,
    //     message: 'Cannot remove learning area as it is linked to existing transactions'
    //   });
    // }

    // Remove the assignment
    await SchoolLearningAreaAssignment.findByIdAndDelete(assignmentId);

    return res.status(200).json({
      success: true,
      message: 'Learning area assignment removed successfully',
    });
  } catch (error) {
    logger.error(`Error removing learning area assignment: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: 'Failed to remove learning area assignment',
    });
  }
});

module.exports = router;
