const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/portal/auth/User');
const Role = require('../models/portal/auth/roles');
const AccessLog = require('../models/portal/content/AccessLog'); // New log model
const billingService = require('../services/cms/BillingInfoService');
const SubscriptionService = require('../services/portal/Subscription');
const BillingService = new billingService();
const Teacher = require('../models/portal/content/Teacher');

exports.auth = async (req, res, next) => {
  try {
    const checktoken = req.headers['authorization'];
    const ipAddress = req.ip || req.connection.remoteAddress; // Get client IP
    const method = req.method;
    const endpoint = `${req.baseUrl}${req.path}`;

    if (!checktoken) {
      // Log failed attempt: no token
      await AccessLog.create({
        email: 'unknown',
        ipAddress,
        method,
        endpoint,
        description: 'No Authentication token',
        status: 'failed',
      });
      return res.status(403).json({success: false, error: 'No Authentication token'});
    }

    const token = checktoken.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, async (err, data) => {
      if (err) {
        // Log failed attempt: invalid token
        await AccessLog.create({
          email: 'unknown',
          ipAddress,
          method,
          endpoint,
          description: 'Invalid access token',
          status: 'failed',
        });
        return res.status(403).json({error: 'Invalid access token'});
      }

      const user_data = await User.findById(data.AuthUser._id).populate('school').populate('role').lean();
      if (!user_data) {
        console.log('User not found');
        await AccessLog.create({
          email: 'unknown',
          ipAddress,
          method,
          endpoint,
          description: 'Invalid Access Token',
          status: 'failed',
        });
        return res.status(403).json({success: false, error: 'Invalid Access Token'});
      }
      const teacher = await Teacher.findOne({email: user_data?.email}).lean();
      const user = {
        ...user_data,
        ...(teacher?._id ? {teacher: teacher._id} : {}),
      };
    console.log(user);

      if (user.status == 0) {
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
        return res.status(403).json({
          success: false,
          error: 'Your account has been disabled, contact school admin',
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
          description: 'School account deactivated',
          status: 'failed',
        });
        return res.status(403).json({
          success: false,
          error: 'Your account has been disabled, contact school admin',
        });
      }

      // Log successful access
      await AccessLog.create({
        userId: user._id,
        email: user.email,
        schoolId: user.school?._id,
        roleId: user.role?._id,
        ipAddress,
        method,
        endpoint,
        description: 'Access granted to this resource',
        status: 'success',
      });

      const module = req.baseUrl.split('/')[2];
      const path = req.path.split('/')[1];

      req.user = user;
      req.role = user.role;
      req.current_session = user?.school?.current_session;
      req.model = 'PortalUser';
      req.school = user?.school?._id;

      next();
    });
  } catch (e) {
    logger.info(e.message);
    // Log internal server error
    await AccessLog.create({
      email: 'unknown',
      ipAddress: req.ip || req.connection.remoteAddress,
      method: req.method,
      endpoint: `${req.baseUrl}${req.path}`,
      description: 'Permission denied to access this resource' + e.message,

      status: 'failed',
    });
    return res.status(500).json({success: false, error: 'Internal Server Error'});
  }
};

exports.checkPermission = (module, permission) => {
  return async (req, res, next) => {
    const userRole = req.role;
    const role = await Role.findById(userRole);
    if (!role) return res.status(403).json({message: 'Role not found'});

    const allowedPermissions = role.permissions.get(module) || [];
    if (!allowedPermissions.includes(permission)) {
      // Log permission denied
      await AccessLog.create({
        userId: req.user._id,
        email: req.user.email,
        schoolId: req.user.school?._id,
        roleId: req.role?._id,
        ipAddress: req.ip || req.connection.remoteAddress,
        method: req.method,
        endpoint: `${req.baseUrl}${req.path}`,
        description: 'Permission denied to access this resource' + module,
        status: 'failed',
      });
      return res.status(403).json({message: 'Permission denied'});
    }

    next();
  };
};

exports.isAllowed = async (req, module, permission) => {
  const userRole = req.role;
  if (!userRole) return false;

  const role = await Role.findById(userRole);
  if (!role) return false;

  const allowedPermissions = role.permissions.get(module) || [];
  return allowedPermissions.includes(permission);
};
