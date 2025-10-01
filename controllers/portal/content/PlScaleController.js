const express = require('express');
const router = express.Router();
const GradingService = require('../../../services/portal/PlScaleService'); // Import the GradingService
const PlDescriptorService = require('../../../services/cms/PlDescriptor'); // Import the service
const {checkPermission} = require('../../../middleware/portal-auth');

// Route to assign default grading scale
router.post('/', checkPermission('grading-scale', 'create'), async (req, res) => {
  const {name, grade} = req.body;
  let school = req?.user?.school;

  try {
    const defaultGradings = await PlDescriptorService.getAllDescriptors();

    const scale = await GradingService.assignDefaultGradingScale(name, grade, school, false, defaultGradings);
    res.status(200).json({
      message: 'Default grading scale assigned successfully',
      scale,
    });
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.get('/', checkPermission('grading-scale', 'read'), async (req, res) => {
  const {name, grade} = req.body;
  let school = req?.user?.school;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  try {
    const scale = await GradingService.fetchScales(school, page, limit);
    res.status(200).json(scale);
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.get('/:id', checkPermission('grading-scale', 'read'), async (req, res) => {
  const {id} = req.params;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.getGradingScaleById(id, school);
    res.status(200).json({data: scale, message: 'Retrieved Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.put('/:id', checkPermission('grading-scale', 'update'), async (req, res) => {
  const {id} = req.params;
  const scaleData = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.updateGradingScaleSchool(id, scaleData, school);

    res.status(200).json({data: scale, message: 'Updates Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.put('/update-name/:id', checkPermission('grading-scale', 'update'), async (req, res) => {
  const {id} = req.params;
  const {name} = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.updateGradingScaleName(school, id, name);
    res.status(200).json({data: scale, message: 'Updates Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.delete('/:id', checkPermission('grading-scale', 'delete'), async (req, res) => {
  const {id} = req.params;
  const scaleData = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.deleteGradingScaleById(id, school);
    res.status(200).json({data: scale, message: 'Deleted Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});

module.exports = router;
