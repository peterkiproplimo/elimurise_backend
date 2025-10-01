const jwt = require('jsonwebtoken');
const logger = require('../utils/logger');
const User = require('../models/cms/auth/User');
exports.auth = async (req, res, next) => {
  try {
    const checktoken = req.headers['authorization'];
    if (!checktoken) {
      return res.status(403).json({success: false, error: 'No Authentication token'});
    }
    const token = checktoken.split(' ')[1];
    jwt.verify(token, process.env.JWT_SECRET, async (err, data) => {
      if (err != null) return res.status(401).json({error: 'invalid access token'});
      const user = await User.findById(data.AuthUser._id);

      if (!user) {
        return res.status(403).json({success: false, error: 'Invalid Access Token'});
      } else if (user.status == 0) {
        return res.status(703).json({success: false, error: 'Account Disabled By Administrator'});
      }

      req.user = user;
      next();
    });
  } catch (e) {
    // console.log(e)
    logger.info(e.message);
    return res.status(404).json({success: false, error: 'Internal Server Error'});
  }
};
