// routes/gradeUserAssignmentRoutes.js

const express = require('express');
const router = express.Router();
const GradeUserAssignment = require('../../../models/portal/content/grade_teacher_asigment');
const LearningArea = require('../../../models/cms/content/learning_area');
const {ExceptionHandler} = require('winston');
const Stream = require('../../../models/portal/content/Stream');
const {checkPermission} = require('../../../middleware/portal-auth');

router.post('/', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    const {user, stream, learningArea} = req.body;
    const current_session = req?.current_session;

    if (!learningArea || !current_session || learningArea.length < 1) {
      return res.status(400).json({error: 'Select at least one learning area'});
    }

    if (!user) {
      return res.status(400).json({error: 'User is required'});
    }

    const conflictErrors = [];

    // Phase 1: Check for conflicts and collect names
    for (const learning_area of learningArea) {
      if (learning_area.selected) {
        const conflict = await GradeUserAssignment.findOne({
          learning_area: learning_area.id,
          stream,
          school: req.user.school,
          session: current_session,
        })
          .populate('user', 'firstname surname lastname email')
          .populate('learning_area', 'name');
        console.log(conflict);
        if (conflict) {
          //   return res.status(400).json({
          //   error: conflict,
          //   conflicts: conflict,
          // });
          const assignedUserName = `${conflict.user?.firstname} ${conflict.user?.surname} ${conflict.user?.lastname} ${conflict.user?.email}`;

          conflictErrors.push(
            `Learning area "${conflict.learning_area.name}" is already assigned to ${assignedUserName}`,
          );
        }
      }
    }

    if (conflictErrors.length > 0) {
      return res.status(400).json({
        error: conflictErrors.join('\n'),
        conflicts: conflictErrors,
      });
    }

    // Phase 2: Create assignments
    const savedAssignments = [];

    for (const learning_area of learningArea) {
      if (learning_area.selected) {
        const existing = await GradeUserAssignment.findOne({
          user,
          school: req.user.school,
          learning_area: learning_area.id,
          stream,
          session: current_session,
        });

        if (!existing) {
          const newAssignment = new GradeUserAssignment({
            school: req.user.school,
            user,
            session: current_session,
            stream,
            learning_area: learning_area.id,
          });

          const saved = await newAssignment.save();
          savedAssignments.push(saved);
        }
      }
    }

    if (savedAssignments.length === 0) {
      return res.status(400).json({error: 'No new assignments created'});
    }

    return res.status(201).json({
      message: 'Assignments created successfully',
      data: savedAssignments,
    });
  } catch (error) {
    console.error('Assignment error:', error);
    return res.status(500).json({message: 'Internal server error', error: error.message});
  }
});

// Retrieve all grade user assignments
router.get('/', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    // Extract query parameters
    const {userId, gradeId, search, page = 1, limit = 10} = req.query;
    let school = req?.user?.school;

    // Create filter object
    let filter = {};
    if (userId) {
      filter.user = userId;
    }
    let current_session = req?.current_session;
    filter.session = current_session;

    if (gradeId) {
      const streams = await Stream.find({grade: gradeId, school});
      if (!streams) {
        return res.status(404).json({message: 'No results found'});
      }
      const streams_ids = streams.map(stream => stream._id.toString());

      filter.stream = {$in: streams_ids};
    }
    // if (search) {
    //   filter.$or = [
    //     {'grade.name': {$regex: search, $options: 'i'}},
    //     {'learning_area.name': {$regex: search, $options: 'i'}},
    //     {'user.name': {$regex: search, $options: 'i'}},
    //     // Add other fields you want to search on here
    //   ];
    // }

    // Calculate pagination values
    const skip = (page - 1) * limit;
    console.log(filter);
    // Fetch filtered and paginated assignments
    const assignments = await GradeUserAssignment.find(filter)
      .populate('user')
      .populate('stream')
      .populate('learning_area')
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalRoles = await GradeUserAssignment.countDocuments(filter);
    const totalRolePages = Math.ceil(totalRoles / limit);

    res.status(200).json({
      success: true,
      data: assignments,
      pagination: {
        current_page: parseInt(page),
        total: totalRoles,
        total_pages: totalRolePages,
        per_page: parseInt(limit),
      },
    });
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

// Retrieve a single grade user assignment by ID
router.get('/:id', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    const {id} = req.params;
    let school = req?.user?.school;

    const assignment = await GradeUserAssignment.findOne({_id: id, school});

    if (!assignment) {
      return res.status(404).json({error: 'Assignment not found'});
    }

    res.status(200).json(assignment);
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

// Update a grade user assignment by ID
router.put('/:id', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    const {id} = req.params;
    const {user, grade, learning_area} = req.body;

    const assignment = await GradeUserAssignment.findById(id);

    if (!assignment) {
      return res.status(404).json({error: 'Assignment not found'});
    }

    assignment.user = user || assignment.user;
    assignment.grade = grade || assignment.grade;
    assignment.learning_area = learning_area || assignment.learning_area;

    const updatedAssignment = await assignment.save();
    res.status(200).json(updatedAssignment);
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});
router.delete('/multiple', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    const {ids} = req.body; // Expect an array of IDs in the request body
    const school = req?.user?.school;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({error: 'No IDs provided or invalid format'});
    }

    // Perform bulk deletion
    const result = await GradeUserAssignment.deleteMany({
      _id: {$in: ids},
      school,
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({error: 'No assignments found to delete'});
    }

    res.status(200).json({
      message: `${result.deletedCount} assignments deleted successfully`,
    });
  } catch (error) {
    res.status(500).json({error: error.message});
  }
});

// Delete a grade user assignment by ID
router.delete('/:id', checkPermission('teachers', 'assign-grade'), async (req, res) => {
  try {
    const {id} = req.params;
    let school = req?.user?.school;

    const assignment = await GradeUserAssignment.findOneAndDelete({_id: id, school});

    if (!assignment) {
      return res.status(404).json({error: 'Assignment not found'});
    }

    res.status(200).json({message: 'Assignment deleted successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

router.get('/distinct/learning_areas', checkPermission('assign-grade', 'teachers'), async (req, res) => {
  try {
    // Step 1: Get distinct learning_area IDs
    const distinctLearningAreaIds = await GradeUserAssignment.distinct('learning_area');

    // Step 2: Populate learning_area details
    const distinctLearningAreas = await LearningArea.find({
      _id: {$in: distinctLearningAreaIds},
    });

    res.status(200).json(distinctLearningAreas);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
