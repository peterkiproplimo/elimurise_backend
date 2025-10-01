const express = require('express');
const {body, validationResult} = require('express-validator');
const Role = require('../../../models/portal/auth/roles');

const router = express.Router();

// Create a new role
router.post(
  '/',
  [
    body('name').notEmpty().withMessage('Role name is required'),
    body('permissions').isArray().withMessage('Permissions should be an array'),
  ],
  async (req, res) => {
    // const errors = validationResult(req);
    // if (!errors.isEmpty()) {
    //   return res.status(400).json({errors: errors.array()});
    // }

    try {
      const {name, permissions} = req.body;

      // Create and save the new role
      const newRole = new Role({name, permissions});
      const savedRole = await newRole.save();

      res.status(201).json({message: 'Role created successfully', role: savedRole});
    } catch (error) {
      res.status(500).json({message: 'Error creating role', error});
    }
  },
);

// Get all roles
router.get('/', async (req, res) => {
  try {
    const roles = await Role.find();
    res.status(200).json({data: roles});
  } catch (error) {
    res.status(500).json({message: 'Error fetching roles', error});
  }
});

// Get a single role by ID
router.get('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const role = await Role.findById(id);

    if (!role) {
      return res.status(404).json({message: 'Role not found'});
    }

    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({message: 'Error fetching role', error});
  }
});

// Update a role's name or permissions
router.put('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const {name, permissions} = req.body;

    const updatedRole = await Role.findByIdAndUpdate(id, {name, permissions}, {new: true, runValidators: true});

    if (!updatedRole) {
      return res.status(404).json({message: 'Role not found'});
    }

    res.status(200).json({message: 'Role updated successfully', role: updatedRole});
  } catch (error) {
    res.status(500).json({message: 'Error updating role', error});
  }
});

// Delete a role by ID
router.delete('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const deletedRole = await Role.findByIdAndDelete(id);

    if (!deletedRole) {
      return res.status(404).json({message: 'Role not found'});
    }

    res.status(200).json({message: 'Role deleted successfully'});
  } catch (error) {
    res.status(500).json({message: 'Error deleting role', error});
  }
});

// Update role permissions
router.put('/:id/permissions', async (req, res) => {
  try {
    const {id} = req.params;
    const {module, permissions} = req.body;

    if (typeof module !== 'string' || !module.trim()) {
      return res.status(400).json({message: 'Invalid module name'});
    }

    if (!Array.isArray(permissions)) {
      return res.status(400).json({message: 'Permissions should be an array'});
    }

    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({message: 'Role not found'});
    }

    role.permissions.set(module, permissions);
    const updatedRole = await role.save();

    res.status(200).json({message: 'Permissions updated successfully', role: updatedRole});
  } catch (error) {
    res.status(500).json({message: 'Error updating permissions', error});
  }
});

module.exports = router;
