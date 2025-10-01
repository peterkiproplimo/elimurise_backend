const express = require('express');
const {body, validationResult} = require('express-validator');
const router = express.Router();
const RoleService = require('../../../services/portal/RoleService');
const logger = require('../../../utils/logger');
// const Permission = require("../../../models/portal/auth/Permissions");
const Module = require('../../../models/portal/auth/module');
// Create a role with validation
router.post(
  '/',
  // [body("name").notEmpty().withMessage("Name is required")],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({errors: errors.array()});
    }

    try {
      const {name, permissions} = req.body;
      const status = 0;
      const newRole = await RoleService.createRole(name, permissions);
      res.status(201).json({success: true, data: newRole});
    } catch (error) {
      res.status(404).json({
        success: false,
        error: `Error creating role ${error.message}`,
      });
    }
  },
);
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.limit) || 10; // Set your desired page size

    const searchRole = req.query.search || '';

    const skipRoles = (page - 1) * pageSize;

    const rolesQuery = {
      name: {$regex: new RegExp(searchRole, 'i')},
    };
    const modules = await Module.find();
    const totalRoles = await RoleService.countRoles(rolesQuery);
    const totalRolePages = Math.ceil(totalRoles / pageSize);

    const roles = await RoleService.getRolesWithPagination(rolesQuery, skipRoles, pageSize);

    res.status(200).json({
      success: true,
      data: {
        roles: roles,
        module: modules,
      },
      pagination: {
        current_page: page,
        total: totalRoles,
        total_pages: totalRolePages,
        per_page: pageSize,
      },
      search: {
        role: searchRole,
      },
    });
  } catch (error) {
    res.status(404).json({success: false, error: 'Error fetching roles ' + error.message});
  }
});

// Get role by ID
router.get('/:roleId', async (req, res) => {
  try {
    const {roleId} = req.params;
    const role = await RoleService.getRoleById(roleId);
    const permissions = await Permission.find({role: roleId}).get();
    const permissionsData = permissions && permissions.length ? permissions : [];

    if (!role) {
      return res.status(404).json({success: false, message: 'Role not found'});
    }
    res.status(200).json({
      success: true,
      data: {role: role, permissions: permissionsData},
    });
  } catch (error) {
    res.status(404).json({success: false, error: 'Error fetching role'});
  }
});

// Update role by ID with validation
router.put('/:roleId', [body('name').optional().notEmpty().withMessage('Name is required')], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(404).json({errors: errors.array()});
  }

  try {
    const {roleId} = req.params;
    const updatedRole = req.body;
    const role = await RoleService.updateRoleById(roleId, updatedRole);
    if (!role) {
      return res.status(404).json({success: false, message: 'Role not found'});
    }
    res.status(200).json({success: true, data: role});
  } catch (error) {
    logger.info('', error);
    res.status(404).json({success: false, error: 'Error updating role'});
  }
});

// Delete role by ID
router.delete('/:roleId', async (req, res) => {
  try {
    const {roleId} = req.params;
    const deletedRole = await RoleService.deleteRoleById(roleId);
    if (!deletedRole) {
      return res.status(404).json({success: false, message: 'Role not found'});
    }
    res.status(200).json({success: true, data: deletedRole});
  } catch (error) {
    res.status(404).json({success: false, error: 'Error deleting role'});
  }
});

module.exports = router;
