const express = require('express');
const router = express.Router();
const GradingService = require('../../../services/portal/PlScaleService'); // Import the GradingService
const PlDescriptorService = require('../../../services/cms/PlDescriptor'); // Import the service

// const defaultGradings = [
//   {mark: 80, score: 4, description: 'Excellent'},
//   {mark: 60, score: 3, description: 'Good'},
//   {mark: 50, score: 2, description: 'Average'},
//   {mark: 0, score: 1, description: 'Needs Improvement'},
// ];
// Route to assign default grading scale
router.post('/', async (req, res) => {
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
router.get('/', async (req, res) => {
  const {name, grade} = req.body;
  let school = req?.user?.school;
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;
  try {
    const scale = await GradingService.fetchScales(undefined, page, limit);
    res.status(200).json(scale);
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.get('/:id', async (req, res) => {
  const {id} = req.params;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.getGradingScaleById(id, undefined);
    res.status(200).json({data: scale, message: 'Retrieved Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.put('/:id', async (req, res) => {
  const {id} = req.params;
  const scaleData = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.updateGradingScaleSchool(id, scaleData, undefined);

    res.status(200).json({data: scale, message: 'Updates Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.put('/update-name/:id', async (req, res) => {
  const {id} = req.params;
  const {name} = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.updateGradingScaleName(undefined, id, name);
    res.status(200).json({data: scale, message: 'Updates Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});
router.delete('/:id', async (req, res) => {
  const {id} = req.params;
  const scaleData = req.body;
  let school = req?.user?.school;

  try {
    const scale = await GradingService.deleteGradingScaleById(id, undefined);
    res.status(200).json({data: scale, message: 'Deleted Successifully'});
  } catch (error) {
    res.status(404).json({
      message: 'Error assigning default grading scale',
      error: error.message,
    });
  }
});

module.exports = router;
