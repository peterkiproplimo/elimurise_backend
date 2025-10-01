const express = require('express');
const router = express.Router();
const SchoolService = require('../../../../services/portal/SchoolService');
const LearnerService = require('../../../../services/portal/LearnersService');
const EnrollmentService = require('../../../../services/portal/EnrollmentService');
const billingService = require('../../../../services/cms/BillingInfoService');
const {body, validationResult} = require('express-validator');
const UserService = require('../../../../services/portal/UserService');
const mongoose = require('mongoose');
const PortalRole = require('../../../../models/portal/auth/roles');
const {generateNextSession, ROLE} = require('../../../../utils/helper');
const userService = new UserService();
const jwt = require('jsonwebtoken');

const BillingService = new billingService();
const schoolService = new SchoolService();
const learnerService = new LearnerService();
const enrollmentService = new EnrollmentService();

// GET /schools
router.get('/schools', async (req, res) => {
  try {
    const {page, limit, search, county, subcounty} = req.query;
    const query = {name: {$regex: new RegExp(search, 'i')}};
    if (county) {
      query.county = county;
    }
    if (subcounty) {
      query.subcounty = subcounty;
    }
    const schools = await schoolService.getSchools(page, limit, query);
    return res.json(schools);
  } catch (error) {
    res.status(404).json({error: error.message, success: false});
  }
});

//leaners

router.get('/learners/:school', async (req, res) => {
  try {
    const {page, limit} = req.query;
    const school = req.params.school;

    const learners = await learnerService.getLearners(page, limit, {school});
    return res.json(learners);
  } catch (error) {
    res.status(404).json({error: error.message, success: false});
  }
});
router.get('/enrollments/:learner', async (req, res) => {
  try {
    const {page, limit} = req.query;
    const learner = req.params.learner;
    console.log(learner);
    const learners = await enrollmentService.getEnrollments(page, limit, {learner});
    return res.json(learners);
  } catch (error) {
    res.status(404).json({error: error.message, success: false});
  }
});
router.get('/subscriptions', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const paginatedBillingInfo = await BillingService.getPaginatedBillingInfo(page, limit);
    res.status(200).json({success: true, ...paginatedBillingInfo});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});
router.put('/subscriptions/:id/toggle', async (req, res) => {
  try {
    const billing = req.params.id;
    const paginatedBillingInfo = await BillingService.toggleBillingType(billing);
    res.status(200).json({success: true, ...paginatedBillingInfo});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});
router.put('/subscriptions/:id/status', async (req, res) => {
  try {
    const billing = req.params.id;
    const paginatedBillingInfo = await BillingService.toggleBillingStatus(billing);
    res.status(200).json({success: true, ...paginatedBillingInfo});
  } catch (error) {
    res.status(404).json({success: false, message: error.message});
  }
});
router.post(
  '/schools/school-register',
  [
    // Validate fields using express-validator
    body('email').isEmail().withMessage('Invalid email format'),

    body('password').isLength({min: 6}).withMessage('Password must be at least 6 characters long'),

    body('firstname').notEmpty().withMessage('First name is required'),

    body('lastname').notEmpty().withMessage('Last name is required'),

    body('phone').notEmpty().withMessage('Phone number is required'),

    // body('plan').notEmpty().withMessage('Plan is required'),

    body('school_name').notEmpty().withMessage('School name is required'),

    body('county').notEmpty().withMessage('County is required'),

    body('subcounty').notEmpty().withMessage('Sub-county is required'),

    body('total_learners')
      .notEmpty()
      .withMessage('Number of learners is required')
      .isNumeric()
      .withMessage('Number of learners must be a numeric value'),
  ],
  async (req, res) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const numberOfLearners = Number(req.body.total_learners);
      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const current_session = `${startYear}`;
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(404).json({success: false, errors: errors.array()});
      }

      // const packageExists = await PackageService.getPackageById(req.body.plan);
      // if (!packageExists) {
      //   return res.status(404).json({message: 'Plan not found'});
      // }
      const school = await schoolService.createSchool(
        {
          name: req.body.school_name,
          numberOfLearners: req.body.total_learners,
          county: req.body.county,
          subcounty: req.body.subcounty,
          current_session,
          active: true,
        },
        session,
      );
      const role = await PortalRole.findOne({name: ROLE.SUPER_ADMIN});
      // Create a new user based on the request body
      const newUser = await userService.createUserWithSession(
        {
          firstname: req.body.firstname,
          lastname: req.body.lastname,
          phone: req.body.phone,
          email: req.body.email,
          avatar: req.body.avatar,
          password: req.body.password,
          school: school,
          school_admin: true,
          role: role,
        },
        session,
      );

      // Save the new user to the database
      /// await SubscriptionService.createSubscription(school, packageExists, numberOfLearners, session);
      // Return success response
      const token = jwt.sign({AuthUser: newUser}, process.env.JWT_SECRET);
      // console.log(user);
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        success: true,
        user: newUser,
        token: token,
        // active: !!newUser?.school,
        message: 'Logged in successifully',
      });
    } catch (err) {
      await session.abortTransaction();
      session.endSession();

      // Handle errors
      if (err instanceof Error) {
        return res.status(403).json({success: false, error: err.message});
      }
      logger.error(`Error creating user: ${err.message}`);
      res.status(404).json({success: false, message: 'Failed to create user'});
    }
  },
);
router.put(
  '/schools/:id',
  [
    body('school_name').optional().notEmpty().withMessage('School name cannot be empty'),
    body('county').optional().notEmpty().withMessage('County cannot be empty'),
    body('subcounty').optional().notEmpty().withMessage('Sub-county cannot be empty'),
    body('total_learners').optional().isNumeric().withMessage('Number of learners must be a numeric value'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({success: false, errors: errors.array()});
      }

      const updatedSchool = await schoolService.updateSchool(req.params.id, {
        name: req.body.school_name,
        numberOfLearners: req.body.total_learners,
        county: req.body.county,
        subcounty: req.body.subcounty,
      });
      if (!updatedSchool) {
        return res.status(404).json({success: false, message: 'School not found'});
      }

      res.status(200).json({success: true, school: updatedSchool, message: 'School updated successfully'});
    } catch (error) {
      res.status(500).json({success: false, message: 'Failed to update school'});
    }
  },
);

// Delete School
router.delete('/schools/:id', async (req, res) => {
  try {
    const deletedSchool = await schoolService.deleteSchool(req.params.id);
    if (!deletedSchool) {
      return res.status(404).json({success: false, message: 'School not found'});
    }

    res.status(200).json({success: true, message: 'School deleted successfully'});
  } catch (error) {
    res.status(500).json({success: false, message: 'Failed to delete school'});
  }
});

// Activate School
router.put('/schools/:id/toggle-activation', async (req, res) => {
  try {
    // Fetch the current school data
    const school = await schoolService.getschool(req.params.id);
    if (!school) {
      return res.status(404).json({success: false, message: 'School not found'});
    }

    // Toggle active status
    const updatedSchool = await schoolService.updateSchool(req.params.id, {active: !school.active});

    res.status(200).json({
      success: true,
      school: updatedSchool,
      message: updatedSchool.active ? 'School activated successfully' : 'School deactivated successfully',
    });
  } catch (error) {
    res.status(500).json({success: false, message: 'Failed to toggle school activation'});
  }
});

module.exports = router;
