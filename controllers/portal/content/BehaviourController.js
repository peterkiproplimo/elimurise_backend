const express = require('express');
const mongoose = require('mongoose');

// Define BehaviorCategory model here or import it if it's in a separate file
const BehaviorCategory = require('../../../models/portal/content/BehaviorCategory');
const Stream = require('../../../models/portal/content/Stream');
const Learner = require('../../../models/portal/content/Learner');
const BehaviourAssessment = require('../../../models/portal/content/BehaviourAssessment');
const {checkPermission} = require('../../../middleware/portal-auth');

const router = express.Router();

// Create a new behavior category
router.post('/', checkPermission('behaviour', 'create'), async (req, res) => {
  try {
    const {name, createdBy, EE, ME, AE, BE} = req.body;
    const behaviorCategory = new BehaviorCategory({
      name,
      school: req.school._id,
      EE,
      ME,
      AE,
      BE,
    });
    console.log(behaviorCategory);
    const savedCategory = await behaviorCategory.save();
    res.status(201).json(savedCategory);
  } catch (error) {
    console.log(error);
    res.status(404).json({message: 'Error creating behavior category', error});
  }
});

// Get all behavior categories for a school
router.get('/', checkPermission('behaviour', 'read'), async (req, res) => {
  try {
    const behaviorCategories = await BehaviorCategory.find({school: req.school._id});
    res.status(200).json({data: behaviorCategories});
  } catch (error) {
    res.status(404).json({message: 'Error fetching behavior categories', error});
  }
});

// Get a single behavior category by ID
router.get('/category/:id', checkPermission('behaviour', 'read'), async (req, res) => {
  try {
    const {id} = req.params;
    const behaviorCategory = await BehaviorCategory.findOne({_id: id, school: req.school._id});
    if (!behaviorCategory) {
      return res.status(404).json({message: 'Behavior category not found'});
    }
    res.status(200).json(behaviorCategory);
  } catch (error) {
    res.status(404).json({message: 'Error fetching behavior category', error});
  }
});

// Update a behavior category by ID
router.put('/category/:id', checkPermission('behaviour', 'update'), async (req, res) => {
  try {
    const {id} = req.params;
    const updatedData = req.body;
    const updatedCategory = await BehaviorCategory.findByIdAndUpdate(id, updatedData, {new: true});
    if (!updatedCategory) {
      return res.status(404).json({message: 'Behavior category not found'});
    }
    res.status(200).json(updatedCategory);
  } catch (error) {
    res.status(404).json({message: 'Error updating behavior category', error});
  }
});

// Delete a behavior category by ID
router.delete('/category/:id', checkPermission('behaviour', 'delete'), async (req, res) => {
  try {
    const {id} = req.params;
    const deletedCategory = await BehaviorCategory.findOneAndDelete({_id: id, school: req.school._id});
    if (!deletedCategory) {
      return res.status(404).json({message: 'Behavior category not found'});
    }
    res.status(200).json({message: 'Behavior category deleted successfully'});
  } catch (error) {
    res.status(404).json({message: 'Error deleting behavior category', error});
  }
});

// Get all behavior categories for a school
router.get('/assessment', checkPermission('behaviour', 'read'), async (req, res) => {
  try {
    const {stream, term, behaviour, adm_no} = req.query;
    let school = req?.school?._id;

    let session = req?.current_session;
    if (!school || !stream || !session || !term) {
      return res.status(404).json({error: 'Missing required query parameters'});
    }

    const streamFound = await Stream.findById(stream).populate('grade');
    const learningArea = await BehaviorCategory.findById(behaviour);
    if (!streamFound || !learningArea) {
      return res.status(404).json({success: false, error: 'No leaning area found'});
    }
    const tests = await getLearnersWithAssessmentStatus(school, stream, session, adm_no, behaviour, term);
    res.status(200).json({
      success: true,
      data: tests,
      meta: {
        learningArea,
        stream: streamFound,
      },
    });
  } catch (error) {
    res.status(404).json({success: false, error: error.message});
  }
});
router.put('/assessment', checkPermission('behaviour', 'assess'), async (req, res) => {
  try {
    const data = req.body;
    const existingAssessment = await BehaviourAssessment.findOne({
      learner: data.learner,
      behaviour: data.behaviour,
      term: data.term,
      session: req.current_session,
    });
    const behaviorCategory = await BehaviorCategory.findById(data.behaviour);
    if (!behaviorCategory) {
      return res.status(404).json({error: 'Invalid Score'});
    }
    const learner_data = await Learner.findOne({current_session: req.current_session, _id: data.learner});
    console.log('learner_data', {
      learner: data.learner,
      behaviour: data.learning_area,
      term: data.term,
      session: req.current_session,
    });
    description = '';
    switch (data.score) {
      case 4:
        description = behaviorCategory.EE;
        break;
      case 3:
        description = behaviorCategory.ME;
        break;
      case 2:
        description = behaviorCategory.AE;
        break;
      case 1:
        description = behaviorCategory.BE;
        break;
      default:
        return res.status(404).json({error: 'Invalid Score'});
    }
    if (existingAssessment) {
      // Update existing assessment
      existingAssessment.score = data.score;
      existingAssessment.description = description;
      await existingAssessment.save();
      return res.status(200).json(existingAssessment);
    }

    const assessmentData = {
      ...req.body,
      score: data.score,
      session: req.current_session,
      stream: learner_data.stream,
      grade: learner_data.grade,
      behaviour: data.behaviour,
      description,
    };
    const assessment = new BehaviourAssessment(assessmentData);
    await assessment.save();
    res.status(201).json(assessment);
  } catch (error) {
    console.log(error);
    res.status(404).json({error: error.message});
  }
});

const getLearnersWithAssessmentStatus = async (school, stream, session, adm_no, behaviour, term) => {
  try {
    // Find all enrollments for the specified criteria
    const learnerQuery = {school, stream, current_session: session};

    if (adm_no) {
      const regex = new RegExp(adm_no.trim(), 'i'); // 'i' makes the regex case-insensitive
      learnerQuery.adm_no = regex;
    }

    // Find all learners for the specified criteria
    const learners = await Learner.find(learnerQuery);
    console.log(learnerQuery);

    // Find test data by ID

    // Find assessments for the specified term and indicator
    const assessments = await BehaviourAssessment.find({
      behaviour,
      session,
      term,
      stream,
    }).populate('learner');

    // Create a map of learner IDs to their assessments
    const assessmentMap = assessments.reduce((map, assessment) => {
      const learnerId = assessment.learner._id.toString();
      map[learnerId] = assessment; // Store assessment by learner ID
      return map;
    }, {});
    console.log(assessmentMap);

    // Build the result array with assessment status and details
    const result = learners.map(learner => {
      const learnerId = learner._id.toString();
      const assessment = assessmentMap[learnerId] || null; // Get the assessment if it exists

      return {
        learner,
        assessed: assessment ? true : false, // Set to true if the learner has been assessed
        assessmentDetails: assessment || null, // Include assessment details or null if not found
      };
    });

    return result;
  } catch (error) {
    console.error('Error fetching learners with assessment status:', error);
    throw error; // Throw the error to be handled by the caller
  }
};

// Export the router
module.exports = router;
