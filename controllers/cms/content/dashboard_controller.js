const express = require('express');
const router = express.Router();
const logger = require('../../../utils/logger');
const {redisClient, cacheData} = require('../../../utils/redis');
const BillingInfo = require('../../../models/cms/content/BillingInfo');
const School = require('../../../models/portal/content/School');
const Users = require('../../../models/cms/auth/User');
const Learner = require('../../../models/portal/content/Learner');
const Parent = require('../../../models/portal/content/Parent');
const Teacher = require('../../../models/portal/content/Teacher');
const AccessLog = require('../../../models/portal/content/AccessLog');
const Role = require('../../../models/portal/auth/roles');
const {ObjectId} = require('mongodb');

// Root dashboard endpoint (unchanged)
router.get('/', async (req, res) => {
  try {
    const cacheKey = 'dashboard:stats';
    const data = await cacheData(cacheKey, async () => {
      //school is active
      const activeSchools = await School.find({active: true}).lean();
      const activeSchoolIds = activeSchools.map(school => school._id);
      const activeSchoolIdsSet = new Set(activeSchoolIds);
      const totalLearners = await Learner.countDocuments({school: {$in: activeSchoolIds}});
      const totalParents = await Parent.countDocuments({school: {$in: activeSchoolIds}});
      const totalTeachers = await Teacher.countDocuments({school: {$in: activeSchoolIds}});
      const totalSchools = activeSchools.length;

      const lastAddedUsers = await Users.find({schoolId: {$in: activeSchoolIds}})
        .sort({createdAt: -1})
        .limit(5)
        .lean();
      const lastCreatedSchools = await School.find({active: true}).sort({createdAt: -1}).limit(5).lean();
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 1);

      const revenueData = await BillingInfo.aggregate([
        {$match: {payment: {$ne: null}, startDate: {$gte: startDate}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m', date: '$startDate'}}, totalRevenue: {$sum: '$totalCost'}}},
        {$sort: {_id: 1}},
      ]);

      const subscriptionData = await BillingInfo.aggregate([
        {$match: {payment: {$ne: null}, startDate: {$gte: startDate}}},
        {$group: {_id: {$dateToString: {format: '%Y-%m', date: '$startDate'}}, count: {$sum: 1}}},
        {$sort: {_id: 1}},
      ]);

      const byCountySchools = await School.aggregate([
        {$group: {_id: '$county', count: {$sum: 1}}},
        {$project: {_id: 0, county: '$_id', count: 1}},
        {$sort: {count: -1}},
      ]);

      const months = [];
      let currentDate = new Date();
      for (let i = 0; i < 12; i++) {
        months.unshift(currentDate.toISOString().slice(0, 7));
        currentDate.setMonth(currentDate.getMonth() - 1);
      }

      const revenueMap = revenueData.reduce((acc, item) => {
        acc[item._id] = item.totalRevenue;
        return acc;
      }, {});
      const subscriptionMap = subscriptionData.reduce((acc, item) => {
        acc[item._id] = item.count;
        return acc;
      }, {});

      const revenueDataset = months.map(month => ({_id: month, totalRevenue: revenueMap[month] || 0}));
      const subscriptionDataset = months.map(month => ({_id: month, subscriptionCount: subscriptionMap[month] || 0}));

      const highestPayingSchools = await BillingInfo.find({})
        .sort({totalCost: -1})
        .limit(5)
        .populate('school', 'name location')
        .lean();

      return {
        stats: {totalSchools, totalTeachers, totalLearners, totalParents},
        insights: {subscriptionDataset, revenueDataset, highestPayingSchools, byCountySchools},
        summary: {lastAddedUsers, lastCreatedSchools},
      };
    });

    res.json(data);
  } catch (error) {
    logger.error(`Error fetching dashboard data: ${error.message}`);
    res.status(404).json({message: 'Error fetching dashboard data', error});
  }
});

// Middleware to log access (unchanged)
const logAccess = async (req, res, next) => {
  const ipAddress = req.ip || req.connection.remoteAddress;
  const method = req.method;
  const endpoint = `${req.baseUrl}${req.path}`;
  try {
    const roleCacheKey = `role:${req.user.role?._id}`;
    let roleName = await redisClient.get(roleCacheKey);
    if (!roleName) {
      const userRole = await Role.findById(req.user.role?._id).select('name').lean();
      roleName = userRole ? userRole.name : 'Unknown Role';
      await redisClient.setex(roleCacheKey, 3600, roleName);
    }

    const logEntry = JSON.stringify({
      userId: req.user._id,
      email: req.user.email,
      schoolId: req.user.school?._id,
      roleId: req.user.role?._id,
      ipAddress,
      method,
      endpoint,
      status: 'success',
      description: `${roleName} accessed ${endpoint}`,
    });
    await redisClient.hset('access_logs', Date.now().toString(), logEntry);
    next();
  } catch (error) {
    logger.error(`Error logging access: ${error.message}`);
    next();
  }
};

// GET /active-users (modified for weekly grouping)
router.get('/active-users', logAccess, async (req, res) => {
  try {
    const cacheKey = 'active_users';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {
          $group: {
            _id: {
              email: '$email',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            totalActions: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.email',
            totalActions: {$sum: '$totalActions'},
          },
        },
        {$sort: {totalActions: -1}},
        {$limit: 10},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching active users: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /actions-by-role (modified for weekly grouping)
router.get('/actions-by-role', logAccess, async (req, res) => {
  try {
    const cacheKey = 'actions_by_role';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$lookup: {from: 'portalroles', localField: 'roleId', foreignField: '_id', as: 'role'}},
        {$unwind: '$role'},
        {
          $group: {
            _id: {
              role: '$role.name',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            totalActions: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.role',
            totalActions: {$sum: '$totalActions'},
          },
        },
        {$sort: {totalActions: -1}},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching actions by role: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /endpoint-usage (modified for weekly grouping)
router.get('/endpoint-usage', logAccess, async (req, res) => {
  try {
    const cacheKey = 'endpoint_usage';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {
          $group: {
            _id: {
              method: '$method',
              endpoint: '$endpoint',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: {method: '$_id.method', endpoint: '$_id.endpoint'},
            count: {$sum: '$count'},
          },
        },
        {$sort: {count: -1}},
        {$limit: 10},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching endpoint usage: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /peak-times (modified for weekly grouping)
router.get('/peak-times', logAccess, async (req, res) => {
  try {
    const cacheKey = 'peak_times';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {
          $group: {
            _id: {
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
              hour: {$hour: '$timestamp'},
              day: {$dayOfWeek: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {$sort: {count: -1}},
        {$limit: 10},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching peak times: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /ip-usage (modified for weekly grouping)
router.get('/ip-usage', logAccess, async (req, res) => {
  try {
    const cacheKey = 'ip_usage';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {
          $group: {
            _id: {
              ipAddress: '$ipAddress',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            users: {$addToSet: '$email'},
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.ipAddress',
            users: {$addToSet: '$users'},
            count: {$sum: '$count'},
          },
        },
        {$unwind: '$users'},
        {$unwind: '$users'},
        {
          $group: {
            _id: '$_id',
            users: {$addToSet: '$users'},
            count: {$first: '$count'},
          },
        },
        {$match: {'users.1': {$exists: true}}},
        {$sort: {count: -1}},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching IP usage: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /success-failure (modified for weekly grouping)
router.get('/success-failure', logAccess, async (req, res) => {
  try {
    const cacheKey = 'success_failure';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {
          $group: {
            _id: {
              endpoint: '$endpoint',
              status: '$status',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: {endpoint: '$_id.endpoint', status: '$_id.status'},
            count: {$sum: '$count'},
          },
        },
        {$sort: {'_id.endpoint': 1, count: -1}},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching success/failure rates: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// GET /system-health (modified for weekly grouping)
router.get('/system-health', logAccess, async (req, res) => {
  try {
    const cacheKey = 'system_health';
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {status: 'failed'}},
        {
          $group: {
            _id: {
              description: '$description',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.description',
            count: {$sum: '$count'},
          },
        },
        {$sort: {count: -1}},
        {$limit: 10},
      ]);
    });
    res.json({success: true, data});
  } catch (error) {
    logger.error(`Error fetching system health: ${error.message}`);
    res.status(500).json({success: false, error: error.message});
  }
});

// Middleware to validate school (unchanged)
const validateSchool = async (req, res, next) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}`;
    const school = await cacheData(cacheKey, async () => {
      const s = await School.findById(schoolId).lean();
      if (!s) throw new Error('School not found');
      return s;
    });
    req.school = school;
    next();
  } catch (error) {
    logger.error(`Error validating school: ${error.message}`);
    res.status(500).json({message: 'Error validating school', error: error.message});
  }
};

// School-specific endpoints (modified for weekly grouping)
router.get('/school/:schoolId/active-users', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:active_users`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {
          $group: {
            _id: {
              email: '$email',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            totalActions: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.email',
            totalActions: {$sum: '$totalActions'},
          },
        },
        {$sort: {totalActions: -1}},
        {$limit: 5},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching active users for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching active users', error: error.message});
  }
});

router.get('/school/:schoolId/actions-by-role', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:actions_by_role`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {$lookup: {from: 'portalroles', localField: 'roleId', foreignField: '_id', as: 'role'}},
        {$unwind: '$role'},
        {
          $group: {
            _id: {
              role: '$role.name',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            totalActions: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.role',
            totalActions: {$sum: '$totalActions'},
          },
        },
        {$sort: {totalActions: -1}},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching actions by role for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching actions by role', error: error.message});
  }
});

router.get('/school/:schoolId/endpoint-usage', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:endpoint_usage`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {
          $group: {
            _id: {
              method: '$method',
              endpoint: '$endpoint',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: {method: '$_id.method', endpoint: '$_id.endpoint'},
            count: {$sum: '$count'},
          },
        },
        {$sort: {count: -1}},
        {$limit: 5},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching endpoint usage for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching endpoint usage', error: error.message});
  }
});

router.get('/school/:schoolId/peak-times', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:peak_times`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {
          $group: {
            _id: {
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
              hour: {$hour: '$timestamp'},
              day: {$dayOfWeek: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {$sort: {count: -1}},
        {$limit: 5},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching peak times for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching peak times', error: error.message});
  }
});

router.get('/school/:schoolId/ip-usage', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:ip_usage`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {
          $group: {
            _id: {
              ipAddress: '$ipAddress',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            users: {$addToSet: '$email'},
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.ipAddress',
            users: {$addToSet: '$users'},
            count: {$sum: '$count'},
          },
        },
        {$unwind: '$users'},
        {$unwind: '$users'},
        {
          $group: {
            _id: '$_id',
            users: {$addToSet: '$users'},
            count: {$first: '$count'},
          },
        },
        {$match: {'users.1': {$exists: true}}},
        {$sort: {count: -1}},
        {$limit: 5},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching IP usage for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching IP usage', error: error.message});
  }
});

router.get('/school/:schoolId/success-failure', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:success_failure`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId)}},
        {
          $group: {
            _id: {
              endpoint: '$endpoint',
              status: '$status',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: {endpoint: '$_id.endpoint', status: '$_id.status'},
            count: {$sum: '$count'},
          },
        },
        {$sort: {'_id.endpoint': 1, count: -1}},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching success/failure rates for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching success/failure rates', error: error.message});
  }
});

router.get('/school/:schoolId/system-health', logAccess, validateSchool, async (req, res) => {
  try {
    const {schoolId} = req.params;
    const cacheKey = `school:${schoolId}:system_health`;
    const data = await cacheData(cacheKey, async () => {
      return await AccessLog.aggregate([
        {$match: {schoolId: new ObjectId(schoolId), status: 'failed'}},
        {
          $group: {
            _id: {
              description: '$description',
              week: {$week: '$timestamp'},
              year: {$year: '$timestamp'},
            },
            count: {$sum: 1},
          },
        },
        {
          $group: {
            _id: '$_id.description',
            count: {$sum: '$count'},
          },
        },
        {$sort: {count: -1}},
        {$limit: 10},
      ]);
    });
    res.json({school: {name: req.school.name, location: req.school.location, county: req.school.county}, data});
  } catch (error) {
    logger.error(`Error fetching system health for school: ${error.message}`);
    res.status(500).json({message: 'Error fetching system health', error: error.message});
  }
});

module.exports = router;
