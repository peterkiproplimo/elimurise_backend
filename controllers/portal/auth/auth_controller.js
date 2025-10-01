const jwt = require('jsonwebtoken');
const logger = require('../../../utils/logger');
const User = require('../../../models/portal/auth/User');
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const UserService = require('../../../services/portal/UserService');
const {body, validationResult} = require('express-validator');
const billingService = require('../../../services/cms/BillingInfoService');
const {generateNextSession, ROLE} = require('../../../utils/helper');
const BillingService = new billingService();
const userService = new UserService();
const mongoose = require('mongoose');
const Teacher = require('../../../models/portal/content/Teacher');
const packageService = require('../../../services/cms/PackageService');
const PackageService = new packageService();
const schoolService = require('../../../services/portal/SchoolService');
const SubscriptionService = require('../../../services/portal/Subscription');
const PortalRole = require('../../../models/portal/auth/roles');
const SchoolService = new schoolService();
const AccessLog = require('../../../models/portal/content/AccessLog'); // Import AccessLog model

router.post('/login', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const email = req.body.email;
    const password = req.body.password;

    const user = await User.findOne({email})
      .populate('role')
      .populate('school', 'name current_session logo primaryColor secondaryColor active')
      .lean();
    const teacher = await Teacher.findOne({email: email}).lean();

    if (!user) {
      await AccessLog.create({
        email: email || 'unknown',
        ipAddress,
        method,
        endpoint,
        status: 'failed',
      });
      logger.warn(`Login failed: No user found for email ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Wrong username or password',
      });
    }

    const isUser = await bcrypt.compare(password, user.password);
    if (!isUser) {
      await AccessLog.create({
        userId: user._id,
        email: user.email,
        schoolId: user.school?._id,
        roleId: user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
      });
      logger.warn(`Login failed: Incorrect password for ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Wrong username or password',
      });
    }

    if (user.status === 0) {
      await AccessLog.create({
        userId: user._id,
        email: user.email,
        schoolId: user.school?._id,
        roleId: user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
      });
      logger.warn(`Login failed: Account deactivated for ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated, contact administrator',
      });
    }

    if (!user.school.active) {
      await AccessLog.create({
        userId: user._id,
        email: user.email,
        schoolId: user.school?._id,
        roleId: user.role?._id,
        ipAddress,
        method,
        endpoint,
        status: 'failed',
      });
      logger.warn(`Login failed: School account deactivated for ${email}`);
      return res.status(401).json({
        success: false,
        message: 'School account is deactivated, contact administrator',
      });
    }

    const token = jwt.sign(
      {
        AuthUser: {
          ...user,
          ...(teacher?._id ? {teacher: teacher._id} : {}),
        },
      },
      process.env.JWT_SECRET,
    );

    const next_session = generateNextSession(user.school.current_session);

    // Log successful login
    await AccessLog.create({
      userId: user._id,
      email: user.email,
      schoolId: user.school?._id,
      roleId: user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
    });
    logger.info(`Login successful for ${email}`);

    return res.status(200).json({
      success: true,
      user: {...user, teacher: teacher?._id ? teacher._id : undefined},
      school: {...user.school, next_session},
      token: token,
      active: !!user?.school,
      message: 'Logged in successfully',
    });
  } catch (e) {
    await AccessLog.create({
      email: req.body.email || 'unknown',
      ipAddress,
      method,
      endpoint,
      status: 'failed',
    });
    logger.error(`Login error for ${req.body.email || 'unknown'}: ${e.message}`);
    return res.status(500).json({success: false, error: 'Internal Server Error'});
  }
});

router.post('/forgot-password', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const email = req.body.email;
    const forgot = await userService.sendOTP(email);

    // Log successful forgot password request
    await AccessLog.create({
      email,
      ipAddress,
      method,
      endpoint,
      status: 'success',
    });
    logger.info(`Forgot password OTP sent successfully for ${email}`);

    return res.status(200).json({success: true, message: forgot});
  } catch (e) {
    await AccessLog.create({
      email: req.body.email || 'unknown',
      ipAddress,
      method,
      endpoint,
      status: 'failed',
    });
    logger.error(`Forgot password error for ${req.body.email || 'unknown'}: ${e.message}`);
    return res.status(404).json({success: false, message: e.message});
  }
});

router.post('/reset-password', async (req, res) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;

  try {
    const {password, token} = req.body;
    const forgot = await userService.resetPassword(token, password);

    // Assuming resetPassword returns the email of the user
    const email = forgot.email || 'unknown'; // Adjust based on your UserService response
    await AccessLog.create({
      email,
      ipAddress,
      method,
      endpoint,
      status: 'success',
    });
    logger.info(`Password reset successfully for ${email}`);

    return res.status(200).json({success: true, message: forgot});
  } catch (e) {
    await AccessLog.create({
      email: 'unknown', // Token might not reveal email, so we log as unknown on failure
      ipAddress,
      method,
      endpoint,
      status: 'failed',
    });
    logger.error(`Reset password error: ${e.message}`);
    return res.status(404).json({success: false, message: e.message});
  }
});

module.exports = router;
