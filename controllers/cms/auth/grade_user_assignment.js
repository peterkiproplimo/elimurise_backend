// routes/gradeUserAssignmentRoutes.js

const express = require('express');
const router = express.Router();
const GradeUserAssignment = require('../../../models/cms/auth/grade_user_asigment');
const LearningArea = require('../../../models/cms/content/learning_area');
const {ExceptionHandler} = require('winston');

// Create a new grade user assignment
router.post('/', async (req, res) => {
  try {
    const {user, grade, lerningArea} = req.body;
    if (lerningArea.length < 1) {
      return res.status(404).json({error: 'Select Learning Area'});
    } else {
      console.log(lerningArea);
      lerningArea.map(async (learning_area, key) => {
        if (learning_area.selected) {
          const existingAssignment = await GradeUserAssignment.findOne({user, grade, learning_area: learning_area.id});
          if (!existingAssignment) {
            const newAssignment = new GradeUserAssignment({
              user,
              grade,
              learning_area: learning_area.id,
            });
            const savedAssignment = await newAssignment.save();
          }
        }
      });
    }
    // Ensure user is unique before creating

    res.status(201).json({data: 'savedAssignment', message: 'Assignment Created Successiful '});
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

// Retrieve all grade user assignments
router.get('/', async (req, res) => {
  try {
    // Extract query parameters
    const {userId, gradeId, search, page = 1, limit = 10} = req.query;

    // Create filter object
    let filter = {};
    if (userId) {
      filter.user = userId;
    }
    if (gradeId) {
      filter.grade = gradeId;
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
      .populate('grade')
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
router.get('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const assignment = await GradeUserAssignment.findById(id);

    if (!assignment) {
      return res.status(404).json({error: 'Assignment not found'});
    }

    res.status(200).json(assignment);
  } catch (error) {
    res.status(404).json({message: error.message});
  }
});

// Update a grade user assignment by ID
router.put('/:id', async (req, res) => {
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

// Delete a grade user assignment by ID
router.delete('/:id', async (req, res) => {
  try {
    const {id} = req.params;

    const assignment = await GradeUserAssignment.findOneAndDelete({_id: id});

    if (!assignment) {
      return res.status(404).json({error: 'Assignment not found'});
    }

    res.status(200).json({message: 'Assignment deleted successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});
router.get('/distinct/learning_areas', async (req, res) => {
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
