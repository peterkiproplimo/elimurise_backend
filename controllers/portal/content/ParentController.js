const express = require('express');
const router = express.Router();
const ParentService = require('../../../services/portal/ParentServce');
const Learner = require('../../../models/portal/content/Learner');
const multer = require('multer');
const path = require('path');
const {checkPermission} = require('../../../middleware/portal-auth');
const csvParser = require('csv-parser');
const fs = require('fs');
const parentService = new ParentService();
const AccessLog = require('../../../models/portal/content/AccessLog'); // Our log keeper
const Role = require('../../../models/portal/auth/roles'); // To get role names
const logger = require('../../../utils/logger'); // Simple message writer

// Multer setup for CSV imports
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/elimurise/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});

const importData = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /csv/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) return cb(null, true);
    cb('Error: CSV Only!');
  },
});

// GET / - Fetch all parents
router.get('/', checkPermission('parents', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {page = 1, limit = 10, search, sortBy, sortOrder} = req.query;
    const query = {
      school: req.user.school._id,
      ...(search ? {
        $or: [
          {first_name: {$regex: new RegExp(search, 'i')}},
          {last_name: {$regex: new RegExp(search, 'i')}},
          {surname: {$regex: new RegExp(search, 'i')}},
          {email: {$regex: new RegExp(search, 'i')}},
        ],
      } : {}),
    };
    const parents = await parentService.getParents(Number(page), Number(limit), query, sortBy, sortOrder);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed parents${search ? ` matching "${search}"` : ''}`,
    });
    logger.info(`Parents sent to ${req.user.email} (${roleName})`);

    res.json(parents);
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
      description: `${roleName} couldn’t view parents: ${error.message}`,
    });
    logger.error(`Error fetching parents for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// GET /:id - Fetch a specific parent and their learners
router.get('/:id', async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const query = {_id: id, school: req.user.school._id};
    const parents = await parentService.getOneParent(query);
    const learners = await Learner.find({
      $or: [{guardian: id}, {guardian2: id}],
    }).populate('stream grade guardian guardian2');

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} viewed parent ${id} and their learners`,
    });
    logger.info(`Parent ${id} details sent to ${req.user.email} (${roleName})`);

    res.json({parent: parents, learners: learners});
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
      description: `${roleName} couldn’t view parent ${id}: ${error.message}`,
    });
    logger.error(`Error fetching parent ${id} for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// POST /search - Search for a parent by email or ID
router.post('/search', checkPermission('parents', 'read'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const {search} = req.body;
    if (!search) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t search parents: no search term provided`,
      });
      logger.warn(`No search term for ${req.user?.email || 'unknown'} (${roleName})`);
      throw new Error('Provide required params');
    }

    const parents = await parentService.getOneParentByEmailOrId(search, req.user.school._id);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} searched for parent with "${search}"`,
    });
    logger.info(`Parent search result sent to ${req.user.email} (${roleName})`);

    res.json({success: true, data: parents});
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
      description: `${roleName} couldn’t search parents: ${error.message}`,
    });
    logger.error(`Error searching parents for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// POST / - Create a new parent
router.post('/', checkPermission('parents', 'create'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    let schoolCode = req?.user?.school.schoolCode;
    const parentData = {...req.body, school: school, schoolCode: schoolCode};
    const parent = await parentService.createParent(parentData);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} created parent ${parent.email}`,
    });
    logger.info(`Parent created by ${req.user.email} (${roleName})`);

    res.status(201).json(parent);
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
      description: `${roleName} couldn’t create parent: ${error.message}`,
    });
    logger.error(`Error creating parent for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// PUT /:id - Update an existing parent
router.put('/:id', checkPermission('parents', 'update'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const parent = await parentService.updateParent(id, req.body, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} updated parent ${id}`,
    });
    logger.info(`Parent updated by ${req.user.email} (${roleName})`);

    res.json(parent);
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
      description: `${roleName} couldn’t update parent ${id}: ${error.message}`,
    });
    logger.error(`Error updating parent for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// PUT /welcome-email/all - Queue welcome emails for all parents
router.put('/welcome-email/all', checkPermission('parents', 'update'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const parent = await parentService.queueWelcomeEmails(school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} queued welcome emails for all parents`,
    });
    logger.info(`Welcome emails queued by ${req.user.email} (${roleName})`);

    res.json(parent);
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
      description: `${roleName} couldn’t queue welcome emails: ${error.message}`,
    });
    logger.error(`Error queuing welcome emails for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// PUT /welcome-email/:id - Trigger welcome email for a specific parent
router.put('/welcome-email/:id', checkPermission('parents', 'update'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const parent = await parentService.triggerWelcomeEmail(id, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} triggered welcome email for parent ${id}`,
    });
    logger.info(`Welcome email triggered by ${req.user.email} (${roleName})`);

    res.json(parent);
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
      description: `${roleName} couldn’t trigger welcome email for parent ${id}: ${error.message}`,
    });
    logger.error(`Error triggering welcome email for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// DELETE /:id - Delete a parent
router.delete('/:id', checkPermission('parents', 'delete'), async (req, res) => {
  const {id} = req.params;
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    let school = req?.user?.school;
    const learner = await Learner.findOne({
      $or: [{guardian: id}, {guardian2: id}],
      school,
    });
    if (learner) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t delete parent ${id}: linked to a learner`,
      });
      logger.warn(`Cannot delete parent ${id} for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({success: false, error: 'Cannot delete a parent linked to a learner'});
    }

    const deletedParent = await parentService.deleteParent(id, school);

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} deleted parent ${id}`,
    });
    logger.info(`Parent deleted by ${req.user.email} (${roleName})`);

    res.json({data: deletedParent, message: 'Deleted successfully'});
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
      description: `${roleName} couldn’t delete parent ${id}: ${error.message}`,
    });
    logger.error(`Error deleting parent for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({error: error.message});
  }
});

// POST /import - Import parents from CSV
router.post('/import', checkPermission('parents', 'bulky-import'), importData.single('csvFile'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    if (!req.file) {
      await AccessLog.create({
        userId: req.user?._id,
        email: req.user?.email || 'unknown',
        schoolId: req.user?.school?._id,
        roleId: req.user?.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
        description: `${roleName} couldn’t import parents: no file uploaded`,
      });
      logger.warn(`No file uploaded for ${req.user?.email || 'unknown'} (${roleName})`);
      return res.status(404).json({success: false, error: 'No file uploaded'});
    }

    let school = req?.school;
    let current_session = req?.current_session;
    const parents = [];
    const errors = [];
    const filePath = req.file.path;

    fs.createReadStream(filePath)
      .pipe(csvParser({skipLines: 0}))
      .on('data', async data => {
        if (data['First Name'] && data['Email'] && data['Gender'] && data['ID Number'] && data['Phone Number']) {
          try {
            const parent = {
              school: school,
              schoolCode: req.user.school.schoolCode,
              first_name: data['First Name'],
              surname: data['Surname'],
              last_name: data['Last Name'],
              email: data['Email'],
              phone: data['Phone Number'],
              id_no: data['ID Number'],
              gender: data['Gender'],
            };
            parents.push(parent);
          } catch (error) {
            errors.push({data, error: error.message});
          }
        }
      })
      .on('end', async () => {
        fs.unlinkSync(filePath);

        const insertedParents = await Promise.all(
          parents.map(async parent => {
            try {
              const existingParent = await parentService.getOneParentByEmailOrId(parent.email, parent.school);
              if (existingParent) throw new Error(`Parent with email "${parent.email}" already exists`);
              return await parentService.createParent(parent);
            } catch (error) {
              errors.push({parent, error: error.message});
              return null;
            }
          }),
        );

        const filteredParents = insertedParents.filter(parent => parent !== null);

        await AccessLog.create({
          userId: req.user._id,
          email: req.user.email,
          schoolId: req.user.school?._id,
          roleId: req.user.role?._id,
          ipAddress,
          method,
          endpoint,
          status: 'success',
          description: `${roleName} imported ${filteredParents.length} parents with ${errors.length} errors`,
        });
        logger.info(`Parents imported by ${req.user.email} (${roleName})`);

        res.json({success: true, data: filteredParents, errors});
      });
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
      description: `${roleName} couldn’t import parents: ${error.message}`,
    });
    logger.error(`Error importing parents for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: 'Error inserting data into the database'});
  }
});

// POST /export - Export parents to CSV
router.post('/export', checkPermission('parents', 'bulky-import'), async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const userRole = await Role.findById(req.user.role?._id).select('name').lean();
    const roleName = userRole ? userRole.name : 'Unknown Role';

    const exportData = [];
    const headers = 'First Name,Surname,Last Name,Email,Phone Number,ID Number,Gender';

    await AccessLog.create({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} exported parents (template with headers only)`,
    });
    logger.info(`Parents exported by ${req.user.email} (${roleName})`);

    res.header('Content-Type', 'text/csv');
    res.attachment('parents_data.csv');
    res.send(headers);
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
      description: `${roleName} couldn’t export parents: ${error.message}`,
    });
    logger.error(`Error exporting parents for ${req.user?.email || 'unknown'} (${roleName}): ${error.message}`);

    res.status(404).json({success: false, error: 'Error exporting parent data'});
  }
});

module.exports = router;
