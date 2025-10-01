const express = require('express');
const router = express.Router();
const levelController = require('../controllers/cms/content/level_controller');
const gradesController = require('../controllers/cms/content/grade_controller');
const listLearningAreasController = require('../controllers/cms/content/learning_controller');
const strandController = require('../controllers/cms/content/strand_controller');
const substrandController = require('../controllers/cms/content/substrand_controller');
const authController = require('../controllers/cms/auth/auth_controller');
const roles_controller = require('../controllers/cms/auth/roles');
const usersController = require('../controllers/cms/auth/users_controller');
const packageController = require('../controllers/cms/content/PackagesController');
const MasterController = require('../controllers/cms/content/MasterController');
const grade_user_assignment = require('../controllers/cms/auth/grade_user_assignment');
const schools = require('../controllers/cms/content/portal/PortalController');
const DashboardController = require('../controllers/cms/content/dashboard_controller');
const BulkyController = require('../controllers/cms/content/bulky_processing');
const PlScaleController = require('../controllers/cms/content/PlScaleController');
const testController = require('../controllers/cms/content/TestController');
const pldescriptor = require('../controllers/cms/content/PlDescriptorController');
//lesson routes
const LessonController = require('../controllers/cms/content/LessonController');
const UserService = require('../services/cms/UserService');
const userService = new UserService();
const intercept = require('../middleware/intercept');
const {auth} = require('../middleware/auth');
router.use('/auth', authController);
router.use('/bulk-processing', BulkyController);
router.use('/tests', auth, testController);
router.use('/lesson', LessonController);

router.use(auth);

router.get('/users/profile', userService.getProfile);
router.use(intercept);
router.use('/grading-system', auth, PlScaleController);
router.use('/descriptor', auth, pldescriptor);

router.use('/portal', schools);
// router.use('/master', MasterController);
router.use('/dashboard', DashboardController);
router.use('/level', levelController);
router.use('/grades', gradesController);
router.use('/learning-areas', listLearningAreasController);
router.use('/strand/', strandController);
router.use('/substrand', substrandController);
router.use('/package', packageController);
router.use('/grade-user-assignment', grade_user_assignment);
router.use('/users', usersController);
router.use('/roles', roles_controller);

//ss
module.exports = router;
