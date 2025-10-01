const SchoolLearningAreaAssignment = require('../../../models/portal/content/school_learning_area_assignment');
const LearningArea = require('../../../models/cms/content/learning_area');
const logger = require('../../../utils/logger');
const { checkPermission } = require('../../../middleware/portal-auth');
const express = require('express');
const router = express.Router();

// Get available non-global learning areas for selection
router.get('/available', checkPermission('learning-areas', 'read'), async (req, res) => {
  try {
    const { gradeId } = req.query;
    const schoolId = req.user.school._id;

    // Get non-compulsory learning areas that schools can select from
    const query = { is_compulsory: false };
    if (gradeId) {
      query.grade_id = gradeId;
    }

    const availableLearningAreas = await LearningArea.find(query)
      .populate('grade_id', 'name')
      .sort({ name: 1 });

    // Get currently selected learning areas for this school
    const selectedLearningAreas = await SchoolLearningAreaAssignment.find({
      school: schoolId
    }).populate('learning_area');

    const selectedIds = selectedLearningAreas.map(assignment => assignment.learning_area._id.toString());

    // Filter out already selected learning areas
    const unselectedLearningAreas = availableLearningAreas.filter(
      la => !selectedIds.includes(la._id.toString())
    );

    return res.status(200).json({
      success: true,
      data: {
        available: unselectedLearningAreas,
        selected: selectedLearningAreas
      },
      message: 'Available learning areas for selection retrieved successfully'
    });
  } catch (error) {
    logger.error(`Error fetching available learning areas: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch available learning areas' 
    });
  }
});

// Get currently selected learning areas for a school
router.get('/selected', checkPermission('learning-areas', 'read'), async (req, res) => {
  try {
    const schoolId = req.user.school._id;

    const selectedLearningAreas = await SchoolLearningAreaAssignment.getSchoolLearningAreas(schoolId);

    return res.status(200).json({
      success: true,
      data: selectedLearningAreas,
      message: 'Selected learning areas retrieved successfully'
    });
  } catch (error) {
    logger.error(`Error fetching selected learning areas: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch selected learning areas' 
    });
  }
});

// Select additional learning areas
router.post('/select', checkPermission('learning-areas', 'create'), async (req, res) => {
  try {
    const { learningAreaIds } = req.body;
    const schoolId = req.user.school._id;

    if (!learningAreaIds || !Array.isArray(learningAreaIds) || learningAreaIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Learning area IDs array is required'
      });
    }

    // Validate that all learning areas exist and are non-compulsory
    const availableLearningAreas = await LearningArea.find({
      _id: { $in: learningAreaIds },
      is_compulsory: false
    });

    if (availableLearningAreas.length !== learningAreaIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some learning areas are not available for selection'
      });
    }

    const assignments = await SchoolLearningAreaAssignment.assignLearningAreas(
      schoolId, 
      learningAreaIds
    );

    return res.status(201).json({
      success: true,
      data: assignments,
      message: 'Learning areas selected successfully'
    });
  } catch (error) {
    logger.error(`Error selecting learning areas: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to select learning areas' 
    });
  }
});

// Update selection (e.g., custom lessons per week, notes)
router.put('/selection/:assignmentId', checkPermission('learning-areas', 'update'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { custom_lessons_per_week, notes } = req.body;
    const schoolId = req.user.school._id;

    // Verify the assignment belongs to this school
    const assignment = await SchoolLearningAreaAssignment.findOne({
      _id: assignmentId,
      school: schoolId
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Selection not found or not accessible'
      });
    }

    const updateData = {};
    if (custom_lessons_per_week !== undefined) {
      updateData.custom_lessons_per_week = custom_lessons_per_week;
    }
    if (notes !== undefined) {
      updateData.notes = notes;
    }

    const updatedAssignment = await SchoolLearningAreaAssignment.findByIdAndUpdate(
      assignmentId,
      updateData,
      { new: true }
    ).populate('learning_area').populate('grade_id', 'name');

    return res.status(200).json({
      success: true,
      data: updatedAssignment,
      message: 'Selection updated successfully'
    });
  } catch (error) {
    logger.error(`Error updating selection: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to update selection' 
    });
  }
});

// Remove learning area selection
router.delete('/selection/:assignmentId', checkPermission('learning-areas', 'delete'), async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const schoolId = req.user.school._id;

    // Verify the assignment belongs to this school
    const assignment = await SchoolLearningAreaAssignment.findOne({
      _id: assignmentId,
      school: schoolId
    });

    if (!assignment) {
      return res.status(404).json({
        success: false,
        message: 'Selection not found or not accessible'
      });
    }

    await SchoolLearningAreaAssignment.findByIdAndDelete(assignmentId);

    return res.status(200).json({
      success: true,
      message: 'Learning area selection removed successfully'
    });
  } catch (error) {
    logger.error(`Error removing selection: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to remove selection' 
    });
  }
});

// Bulk remove selections
router.delete('/selections/bulk', checkPermission('learning-areas', 'delete'), async (req, res) => {
  try {
    const { assignmentIds } = req.body;
    const schoolId = req.user.school._id;

    if (!assignmentIds || !Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Assignment IDs array is required'
      });
    }

    // Verify all assignments belong to this school
    const assignments = await SchoolLearningAreaAssignment.find({
      _id: { $in: assignmentIds },
      school: schoolId
    });

    if (assignments.length !== assignmentIds.length) {
      return res.status(400).json({
        success: false,
        message: 'Some selections not found or not accessible'
      });
    }

    await SchoolLearningAreaAssignment.deleteMany({
      _id: { $in: assignmentIds },
      school: schoolId
    });

    return res.status(200).json({
      success: true,
      message: `${assignments.length} learning area selections removed successfully`
    });
  } catch (error) {
    logger.error(`Error bulk removing selections: ${error.message}`);
    return res.status(500).json({ 
      success: false, 
      message: 'Failed to remove selections' 
    });
  }
});

module.exports = router; 