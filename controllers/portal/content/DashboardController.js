const express = require('express');
const mongoose = require('mongoose');
const School = require('../../../models/portal/content/School');
const Learner = require('../../../models/portal/content/Learner');
const Assessment = require('../../../models/portal/content/Asessment');
const Parent = require('../../../models/portal/content/Parent');
const Teacher = require('../../../models/portal/content/Teacher');
const Grade = require('../../../models/cms/content/grade');
const Test = require('../../../models/portal/content/Test');
const {checkPermission, isAllowed} = require('../../../middleware/portal-auth');
const GradeTeacherAssignment = require('../../../models/portal/content/grade_teacher_asigment');
const LearningArea = require('../../../models/cms/content/learning_area');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const logger = require('../../../utils/logger'); // Simple message writer

const router = express.Router(); // Set up a new router to handle requests

// Helper function to make responses look nice
const formatResponse = (success, data = null, error = null) => {
  return {
    success,
    data,
    error, // Include error message if something goes wrong
  };
};

// Get dashboard info (like how many students, parents, etc.)
router.get('/', async (req, res) => {
  const school = req.user.school; // The school this person belongs to
  const ipAddress = req.ip || req.connection.remoteAddress; // Where they’re connecting from
  const method = req.method; // What they’re doing (GET in this case)
  const endpoint = `${req.baseUrl}${req.path}`; // Which page they’re hitting ("/")

  try {
    console.log(req.user);
    // Are they a teacher or someone else (like an admin)?
    if (!req.user.teacher) {
      // For non-teachers (like admins), get big-picture info
      const totalLearners = await Learner.countDocuments({school: school, status: {$in: ['P', 'D']}});
      const totalTests = await Test.countDocuments({
        school: school,
        $or: [{isPublished: false}, {isPublished: {$exists: false}}],
      });
      const totalParents = await Parent.countDocuments({school: school});
      const totalTeachers = await Teacher.countDocuments({school: school});

      // Get the latest 3 parents, 5 learners, and 3 teachers
      const parents = await Parent.find({school: school}).sort({createdAt: -1}).limit(3);
      const learners = await Learner.find({school: school, status: {$in: ['P', 'D']}})
        .sort({createdAt: -1})
        .limit(5);
      const teachers = await Teacher.find({school: school}).sort({createdAt: -1}).limit(3);

      // Get all grades (like Grade 1, Grade 2) and how many learners are in each
      const grades = await Grade.find({}, {_id: 1, name: 1}).sort({level: 1});
      const learnerCounts = await Learner.aggregate([
        {$match: {school: school._id, status: {$in: ['P', 'D']}}}, // Look at this school only
        {$group: {_id: '$grade', count: {$sum: 1}}}, // Count learners per grade
      ]);

      // Match grades with learner counts (if no learners in a grade, show 0)
      const learner_data = grades.map(grade => {
        const learnerCount = learnerCounts.find(lc => lc._id.toString() === grade._id.toString());
        return {
          grade: grade.name,
          count: learnerCount ? learnerCount.count : 0,
        };
      });

      const labels = learner_data.map(item => item.grade); // Names like "Grade 1"
      const values = learner_data.map(item => item.count); // Numbers like 20, 15, 0
      const learnerStreamWise = {labels, values};

      // Log that we got the info
      await AccessLog.create({
        userId: req.user._id, // Who’s looking (their ID)
        email: req.user.email, // Their email
        schoolId: req.user.school?._id, // Their school
        roleId: req.user.role?._id, // Their role (like admin)
        ipAddress, // Where they are
        method, // What they did (GET)
        endpoint, // Which page ("/")
        status: 'success', // It worked!
        description: `Showed school stats: ${totalLearners} students, ${totalTeachers} teachers`, // What they saw
      });
      logger.info(`Dashboard stats sent to ${req.user.email}`);

      // Send the info back to them
      return res.status(200).json(
        formatResponse(true, {
          totalLearners,
          totalParents,
          totalTeachers,
          parents,
          learners,
          teachers,
          totalTests,
          learners_capacity: school.numberOfLearners, // How many students the school can hold
          learnerStreamWise, // Breakdown by grade
        }),
      );
    } else {
      // For teachers, get info about their classes
      const distinctLearningAreaIds = await GradeTeacherAssignment.distinct('learning_area', {user: req.user.teacher});
      const streams = await GradeTeacherAssignment.distinct('stream', {user: req.user.teacher});

      const learners = await Learner.countDocuments({stream: {$in: streams}, status: {$in: ['P', 'D']}});

      // Log that we got teacher-specific info
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'success',
        description: `Showed teacher stats: ${learners} students in ${streams.length} classes`,
      });
      logger.info(`Teacher dashboard stats sent to ${req.user.email}`);

      // Send teacher-specific info
      return res.status(200).json(
        formatResponse(true, {
          no_learning_areas: distinctLearningAreaIds.length, // How many subjects they teach
          no_streams: streams.length, // How many classes they have
          totalLearners: learners, // How many students they teach
        }),
      );
    }
  } catch (error) {
    // Log that something went wrong
    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `Couldn’t load dashboard: ${error.message}`, // Why it failed
    });
    logger.error(`Dashboard error for ${req.user?.email || 'unknown'}: ${error.message}`);

    // Tell them it didn’t work
    res.status(404).json(formatResponse(false, null, error.message));
  }
});

module.exports = router;
