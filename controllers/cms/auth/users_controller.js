const {validationResult} = require('express-validator');
const express = require('express');
const logger = require('../../../utils/logger');
const User = require('../../../models/cms/auth/User');
const UserService = require('../../../services/cms/UserService');
const bcrypt = require('bcryptjs');
const router = express.Router();
const userService = new UserService();
const workflowService = require('../../../services/cms/WorkflowService');
const Workflow = require('../../../models/cms/workflow/workflows');
const Role = require('../../../models/cms/auth/roles');
router.post('/', async (req, res) => {
  try {
    const newUser = await userService.createUser({...req.body});
    res.status(201).json({
      success: true,
      data: newUser,
      message: 'User Created Successfully',
    });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(404).json({success: false, error: err.message});
    }
    logger.error(`Error creating user: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to create user'});
  }
});
const PAGE_SIZE = 10; // Set your desired page size

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || PAGE_SIZE;
    const skip = (page - 1) * limit;

    const searchEmail = req.query.search || '';
    const query = {email: {$regex: new RegExp(searchEmail, 'i')}};

    const usersList = await User.find(query).skip(skip).limit(limit).populate('role_id');

    const totalUsers = await User.countDocuments(query);
    const total_pages = Math.ceil(totalUsers / limit);

    res.status(200).json({
      success: true,
      data: usersList,
      pagination: {
        current_page: page,
        total: totalUsers,
        total_pages: total_pages,
        per_page: limit,
      },
      search: searchEmail,
    });
  } catch (error) {
    logger.error(`Internal Server Error: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

router.delete('/:user', async (req, res) => {
  try {
    const userId = req.params.user;

    const deletedUser = await User.findOneAndDelete({_id: userId, super_admin: false});

    if (deletedUser) {
      res.status(200).json({
        success: true,
        data: deletedUser,
        message: 'User Deleted Successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete user: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

// Additional function to update user details
router.put('/:user', async (req, res) => {
  try {
    const userId = req.params.user;
    const {firstname, lastname, phone, email, avater, role_id} = req.body;

    const updatedUser = await User.findOneAndUpdate(
      {_id: userId, super_admin: false},

      {firstname, lastname, phone, email, avater, role_id},
      {
        new: true,
      },
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'User details updated successfully',
    });
  } catch (error) {
    logger.error(`Failed to update user details: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.put('/:user/activate', async (req, res) => {
  try {
    const userId = req.params.user;

    const updatedUser = await User.findOneAndUpdate(
      {_id: userId},
      {status: 1},
      {
        new: true,
      },
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'User details updated successfully',
    });
  } catch (error) {
    logger.error(`Failed to update user details: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});
router.put('/:user/deactivate', async (req, res) => {
  try {
    const userId = req.params.user;

    const updatedUser = await User.findOneAndUpdate(
      {_id: userId},
      {status: 0},
      {
        new: true,
      },
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
      message: 'User details updated successfully',
    });
  } catch (error) {
    logger.error(`Failed to update user details: ${error.message}`);
    res.status(404).json({success: false, error: 'Internal Server Error'});
  }
});

router.patch('/profile', async (req, res) => {
  const req_user = req.user;

  const {firstname, lastname, phone} = req.body;
  console.log({firstname, lastname, phone});
  const user = await userService.updateUser(req_user._id, {
    firstname,
    lastname,
    phone,
  });
  if (user) {
    return res.status(200).json({success: true, data: user, message: 'Profile Updated successfully'});
  } else {
    return res.status(404).json({success: false, error: 'Failed to Update'});
  }
});
router.patch('/email/:id', async (req, res) => {
  const req_user = req.user;

  const {firstname, lastname, phone} = req.body;
  const user = await userService.updateUser(req_user._id, {
    firstname,
    lastname,
    phone,
  });
  if (user) {
    return res.status(200).json({success: true, data: user});
  } else {
    return res.status(404).json({success: false, data: 'Failed to Update'});
  }
});

router.patch('/:id/workflow/:action', async (req, res) => {
  const {id, action} = req.params;
  const {module} = req.body;
  const workflow = await workflowService.getWorkflowByModule(module);
  let user = await userService.findById(id);
  const workflow_state = user.workflow_state;
  if (!workflow) {
    return res.status(404).json({
      success: false,
      message: 'No workflow exist',
    });
  }
  let rule = workflow.transition_rules.find(
    rule => rule.state._id.equals(workflow_state) && rule.action._id.equals(action),
  );
  if (!rule) {
    return res.status(404).json({success: false, message: 'Invalid Action'});
  }
  const next_state = rule.next_state;
  user.workflow_state = next_state;
  const new_user = await user.save();

  return res.status(200).json({success: true, message: new_user});
});
module.exports = router;
