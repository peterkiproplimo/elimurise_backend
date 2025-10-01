const express = require('express');
const mongoose = require('mongoose');
const Stream = require('../../../models/portal/content/Stream');
const Learner = require('../../../models/portal/content/Learner');
const Comments = require('../../../models/portal/content/Comments');
const {checkPermission} = require('../../../middleware/portal-auth');
const AccessLog = require('../../../models/portal/content/AccessLog');
const Role = require('../../../models/portal/auth/roles');
const logger = require('../../../utils/logger');

const router = express.Router();

// Get behavior assessments for learners
router.get('/assessment', checkPermission('comment', 'read'), async (req, res) => {
  const {stream, term, commentType, assessment, adm_no} = req.query;
  const school = req?.school?._id;
  const session = req?.current_session;

  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    // Validate required parameters
    if (!school || !stream || !session || !term || !commentType) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: school,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} failed to fetch comments: missing required parameters`,
      });
      logger.warn(`Missing parameters for comment fetch by ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(400).json({success: false, error: 'Missing required query parameters'});
    }

    // Validate commentType
    if (!['termly', 'per-assessment'].includes(commentType)) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: school,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} provided invalid commentType: ${commentType}`,
      });
      logger.warn(`Invalid commentType by ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(400).json({success: false, error: 'Invalid commentType'});
    }

    // Validate assessment for per-assessment comments
    if (commentType === 'per-assessment' && !assessment) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: school,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} missing assessment ID for per-assessment comment`,
      });
      logger.warn(`Missing assessment ID for per-assessment comment by ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(400).json({success: false, error: 'Assessment ID required for per-assessment comments'});
    }

    const streamFound = await Stream.findById(stream).populate('grade').lean();
    if (!streamFound) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: school,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t find stream ${stream}`,
      });
      logger.warn(`Stream not found for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({success: false, error: 'Stream not found'});
    }

    const learnersWithComments = await getLearnersWithAssessmentStatus(
      school,
      stream,
      session,
      adm_no,
      commentType,
      term,
      assessment,
    );

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: school,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} fetched comments for stream ${stream} in term ${term} (${commentType})`,
    });
    logger.info(`Comments fetched by ${req.user.email} (${roleName})`);

    res.status(200).json({
      success: true,
      data: learnersWithComments,
      meta: {
        commentType,
        stream: streamFound,
      },
    });
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: school,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} failed to fetch comments: ${error.message}`,
    });
    logger.error(`Error fetching comments for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({success: false, error: error.message});
  }
});

// Create or update a comment
router.put('/assessment', checkPermission('comment', 'create'), async (req, res) => {
  const {learner, term, commentType, comment, stream, grade, assessment} = req.body;
  const session = req.current_session;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    // Validate required fields
    if (!learner || !term || !commentType || !stream || !grade) {
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} failed to save comment: missing required fields`,
      });
      logger.warn(`Missing required fields for comment by ${req.user.email} (${roleName})`);
      return res.status(400).json({success: false, error: 'Missing required fields'});
    }

    // Validate commentType
    if (!['termly', 'per-assessment'].includes(commentType)) {
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} provided invalid commentType: ${commentType}`,
      });
      logger.warn(`Invalid commentType by ${req.user.email} (${roleName})`);
      return res.status(400).json({success: false, error: 'Invalid commentType'});
    }

    // Validate assessment for per-assessment comments
    if (commentType === 'per-assessment' && !assessment) {
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} missing assessment ID for per-assessment comment`,
      });
      logger.warn(`Missing assessment ID for per-assessment comment by ${req.user.email} (${roleName})`);
      return res.status(400).json({success: false, error: 'Assessment ID required for per-assessment comments'});
    }

    // Check if learner exists
    const learnerData = await Learner.findOne({_id: learner, current_session: session}).lean();
    if (!learnerData) {
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t find learner ${learner}`,
      });
      logger.warn(`Learner not found for ${req.user.email} (${roleName})`);
      return res.status(404).json({success: false, error: 'Learner not found'});
    }

    // Find existing comment
    const query = {
      learner,
      term,
      commentType,
      ...(commentType === 'per-assessment' && {assessment}),
    };
    let commentDoc = await Comments.findOne(query);

    if (commentDoc) {
      // Update existing comment
      commentDoc.comment = comment;
      commentDoc.stream = stream;
      commentDoc.grade = grade;
      await commentDoc.save();

      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'success',
        description: `${roleName} updated comment for learner ${learner} in term ${term} (${commentType})`,
      });
      logger.info(`Comment updated by ${req.user.email} (${roleName})`);
      return res.status(200).json({success: true, data: commentDoc});
    } else {
      // Create new comment
      const assessmentData = {
        school: req.user.school?._id,
        learner,
        term,
        commentType,
        comment,
        stream,
        grade,
        session,
        ...(commentType === 'per-assessment' && {assessment}),
      };
      commentDoc = new Comments(assessmentData);
      await commentDoc.save();

      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'success',
        description: `${roleName} created comment for learner ${learner} in term ${term} (${commentType})`,
      });
      logger.info(`Comment created by ${req.user.email} (${roleName})`);
      return res.status(201).json({success: true, data: commentDoc});
    }
  } catch (error) {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AccessLog.create({
      userId: req.user?._id,
      email: req.user?.email || 'unknown',
      schoolId: req.user?.school?._id,
      roleId: req.user?.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'failed',
      description: `${roleName} failed to save comment: ${error.message}`,
    });
    logger.error(`Error saving comment for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(500).json({success: false, error: error.message});
  }
});

const getLearnersWithAssessmentStatus = async (school, stream, session, adm_no, commentType, term, assessment) => {
  try {
    // Validate input parameters
    if (!mongoose.isValidObjectId(school)) throw new Error('Invalid school ID');
    if (!mongoose.isValidObjectId(stream)) throw new Error('Invalid stream ID');
    console.log(`Session: ${session}`);
    if (!['termly', 'per-assessment'].includes(commentType)) throw new Error(`Invalid commentType: ${commentType}`);
    if (commentType === 'per-assessment' && !mongoose.isValidObjectId(assessment)) {
      throw new Error('Invalid or missing assessment ID for per-assessment comment');
    }
    if (!term || isNaN(term)) throw new Error('Invalid term');

    // Log input parameters
    logger.info(
      `Fetching learners with comments: school=${school}, stream=${stream}, session=${session}, adm_no=${adm_no}, commentType=${commentType}, term=${term}, assessment=${assessment}`,
    );

    // Build learner query
    const learnerQuery = {school, stream, current_session: session};
    if (adm_no) {
      learnerQuery.adm_no = new RegExp(adm_no.trim(), 'i');
    }

    const learners = await Learner.find(learnerQuery).lean();
    logger.info(`Found ${learners.length} learners`);

    if (!learners.length) {
      logger.warn('No learners found matching the query');
    }

    // Build comments query
    const commentsQuery = {commentType, term, stream, session};
    if (commentType === 'per-assessment') {
      commentsQuery.assessment = assessment;
    }

    const comments = await Comments.find(commentsQuery)
      .populate({
        path: 'learner',
        select: '_id adm_no nemis_no first_name last_name surname',
      })
      .lean();
    logger.info(`Found ${comments.length} comments`);

    // Check for comments with missing learner population
    comments.forEach(comment => {
      if (!comment.learner) {
        logger.warn(`Comment ${comment._id} has no learner populated`);
      }
    });

    // Map comments to learners
    const commentMap = comments.reduce((map, comment) => {
      if (comment.learner && comment.learner._id) {
        const learnerId = comment.learner._id.toString();
        map[learnerId] = comment;
      }
      return map;
    }, {});
    logger.info(`Comment map keys: ${Object.keys(commentMap).length}`);

    // Build result
    const result = learners.map(learner => {
      const learnerId = learner._id.toString();
      const comment = commentMap[learnerId] || null;

      return {
        learner,
        assessed: !!comment,
        assessmentDetails: comment || null,
      };
    });

    logger.info(`Returning ${result.length} learner records`);
    return result;
  } catch (error) {
    logger.error(`Error fetching learners with comment status: ${error.message}`);
    throw error;
  }
};

module.exports = router;
