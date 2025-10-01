const {validationResult} = require('express-validator');
const express = require('express');
const logger = require('../../../utils/logger');
const User = require('../../../models/portal/auth/User');
const UserService = require('../../../services/portal/UserService');
const bcrypt = require('bcryptjs');
const router = express.Router();
const userService = new UserService();
// const workflowService = require('../../../services/WorkflowService');
// const Workflow = require('../../../models/portal/workflow/workflows');
const Role = require('../../../models/portal/auth/roles');
const {checkPermission} = require('../../../middleware/portal-auth');
router.post('/', checkPermission('users', 'create'), async (req, res) => {
  try {
    const newUser = await userService.createUser({...req.body, school: req.user.school, school_admin: false});
    res.status(201).json({
      success: true,
      data: newUser,
      billing: false,
      message: 'User Created Successfully',
    });
  } catch (err) {
    if (err instanceof Error) {
      return res.status(403).json({success: false, error: err.message});
    }
    logger.error(`Error creating user: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to create user'});
  }
});
const PAGE_SIZE = 10; // Set your desired page size

router.get('/', checkPermission('users', 'read'), async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 1000;
    const skip = (page - 1) * limit;

    const searchEmail = req.query.search || '';
    const query = {email: {$regex: new RegExp(searchEmail, 'i')}};
    query.school = req?.user?.school;
    const usersList = await User.find(query).skip(skip).limit(limit).populate('role');

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

router.delete('/:user', checkPermission('users', 'delete'), async (req, res) => {
  try {
    const userId = req.params.user;
    if (userId == req.user._id) {
      res.status(404).json({success: false, error: 'Cannot delete your own account'});
    }

    const deletedUser = await User.findOneAndDelete({_id: userId, school_admin: false});

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
router.put('/:user', checkPermission('users', 'update'), async (req, res) => {
  try {
    const userId = req.params.user;
    const {firstname, lastname, phone, email, avater, role, password} = req.body;
    if (userId == req.user._id) {
      res.status(404).json({success: false, error: 'Cannot update your own account'});
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {firstname, lastname, phone, email, avater, role},
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
router.put('/:user/activate', checkPermission('users', 'activate'), async (req, res) => {
  try {
    const userId = req.params.user;
    if (userId == req.user._id) {
      res.status(404).json({success: false, error: 'Cannot activate your own account'});
    }
    const updatedUser = await User.findOneAndUpdate(
      {_id: userId, school_admin: false},
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
router.put('/:user/deactivate', checkPermission('users', 'deactivate'), async (req, res) => {
  try {
    const userId = req.params.user;
    if (userId == req.user._id) {
      res.status(404).json({success: false, error: 'Cannot deactivate your own account'});
    }

    const updatedUser = await User.findOneAndUpdate(
      {_id: userId, school_admin: false},
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
router.get('/profile', async (req, res) => {
  const user = req.user;
  const role = await Role.findById(user.role);
  user.role = role;
  console.log(user);
  return res.status(200).json({success: true, data: user});
});

router.patch('/profile', checkPermission('users', 'update-profile'), async (req, res) => {
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
router.patch('/accept-terms', async (req, res) => {
  try {
    const userId = req.user._id;
    const {agreedToTerms} = req.body;

    if (agreedToTerms !== true) {
      return res.status(400).json({success: false, message: 'You must explicitly agree to the terms.'});
    }

    const updatedUser = await userService.updateUser(userId, {
      agreedToTerms: true,
      termsVersion: 'v1.0', // You can make this dynamic if needed
      termsAgreedAt: new Date(),
      termsIP: req.ip,
      termsUserAgent: req.get('User-Agent') || 'unknown',
    });

    if (!updatedUser) {
      return res.status(404).json({success: false, message: 'User not found or update failed'});
    }

    return res.status(200).json({success: true, data: updatedUser});
  } catch (err) {
    return res.status(500).json({success: false, message: err.message});
  }
});

module.exports = router;
