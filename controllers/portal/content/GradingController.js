const express = require('express');
const router = express.Router();
const AssessmentGradingService = require('../../../services/portal/AssessmentGradingService');
const {checkPermission} = require('../../../middleware/portal-auth');
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const Role = require('../../../models/portal/auth/roles'); // To get role names
const logger = require('../../../utils/logger'); // Simple message writer

// POST /api/assessment-gradings - Create a new assessment grading system
router.post('/', checkPermission('grading-system', 'create'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const data = req.body;
    data.school = req?.user?.school._id;
    const newAssessmentGrading = await AssessmentGradingService.createAssessmentGrading(data);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} created new grading system`,
    });
    logger.info(`Grading system created by ${req.user.email} (${roleName})`);

    res.json({success: true, data: newAssessmentGrading});
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
      description: `${roleName} couldn’t create grading system: ${error.message}`,
    });
    logger.error(`Error creating grading system for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: error.message});
  }
});

// POST /api/assessment-gradings/:id/ - Add a learning area to an existing grading system
router.post('/:id/', checkPermission('grading-system', 'create'), async (req, res) => {
  const {id} = req.params;
  const learningAreaData = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const updatedAssessmentGrading = await AssessmentGradingService.addLearningArea(id, learningAreaData);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} added learning area to grading system ${id}`,
    });
    logger.info(`Learning area added by ${req.user.email} (${roleName})`);

    res.status(200).json(updatedAssessmentGrading);
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
      description: `${roleName} couldn’t add learning area to ${id}: ${error.message}`,
    });
    logger.error(`Error adding learning area for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({message: error.message});
  }
});

// PUT /api/assessment-gradings/:id - Update a specific learning area in a grading system
router.put('/:id', checkPermission('grading-system', 'update'), async (req, res) => {
  const {id} = req.params;
  const data = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const updatedAssessmentGrading = await AssessmentGradingService.updateLearningArea(id, data._id, data);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} updated learning area in grading system ${id}`,
    });
    logger.info(`Learning area updated by ${req.user.email} (${roleName})`);

    res.json({success: true, data: updatedAssessmentGrading});
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
      description: `${roleName} couldn’t update learning area in ${id}: ${error.message}`,
    });
    logger.error(`Error updating learning area for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: error.message});
  }
});

// GET /api/assessment-gradings - Get all assessment gradings
router.get('/', checkPermission('grading-system', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {page, limit, search} = req.query;
    const query = {name: {$regex: new RegExp(search, 'i')}};
    query.school = req?.user?.school._id;

    const assessmentGradings = await AssessmentGradingService.getAllAssessmentGradings(query, page, limit);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed all grading systems${search ? ` matching "${search}"` : ''}`,
    });
    logger.info(`Grading systems sent to ${req.user.email} (${roleName})`);

    res.json(assessmentGradings);
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
      description: `${roleName} couldn’t view grading systems: ${error.message}`,
    });
    logger.error(`Error fetching grading systems for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: error.message});
  }
});

// GET /api/assessment-gradings/:id - Get a specific assessment grading by ID
router.get('/:id', checkPermission('grading-system', 'read'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const assessmentGrading = await AssessmentGradingService.getAssessmentGradingById(id);
    if (!assessmentGrading) {
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t find grading system ${id}`,
      });
      logger.warn(`Grading system ${id} not found for ${req.user.email} (${roleName})`);
      return res.status(404).json({success: false, message: 'Assessment grading not found'});
    }

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed grading system ${id}`,
    });
    logger.info(`Grading system ${id} sent to ${req.user.email} (${roleName})`);

    res.json({success: true, data: assessmentGrading});
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
      description: `${roleName} couldn’t view grading system ${id}: ${error.message}`,
    });
    logger.error(
      `Error fetching grading system ${id} for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`,
    );

    res.status(404).json({success: false, error: error.message});
  }
});

// PUT /api/assessment-gradings/update-name/:id - Update the name of an assessment grading
router.put('/update-name/:id', checkPermission('grading-system', 'update'), async (req, res) => {
  const {id} = req.params;
  const data = req.body;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const updatedAssessmentGrading = await AssessmentGradingService.updateAssessmentGrading(id, data);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} updated name of grading system ${id}`,
    });
    logger.info(`Grading system name updated by ${req.user.email} (${roleName})`);

    res.json({success: true, data: updatedAssessmentGrading});
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
      description: `${roleName} couldn’t update name of grading system ${id}: ${error.message}`,
    });
    logger.error(
      `Error updating grading system name for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`,
    );

    res.status(404).json({success: false, error: error.message});
  }
});

// DELETE /api/assessment-gradings/:id - Delete an assessment grading
router.delete('/:id', checkPermission('grading-system', 'delete'), async (req, res) => {
  const {id} = req.params;
  const school = req?.user?.school._id;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    await AssessmentGradingService.deleteAssessmentGrading(id, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} deleted grading system ${id}`,
    });
    logger.info(`Grading system deleted by ${req.user.email} (${roleName})`);

    res.json({success: true, message: 'Assessment grading deleted successfully'});
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
      description: `${roleName} couldn’t delete grading system ${id}: ${error.message}`,
    });
    logger.error(`Error deleting grading system for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: error.message});
  }
});

module.exports = router;
