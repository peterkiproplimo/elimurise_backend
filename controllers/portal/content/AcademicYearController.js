const express = require('express');
const router = express.Router();
const AcademicYearService = require('../../../services/portal/AcademicYearService');
const {body, validationResult} = require('express-validator');

const academicYearService = new AcademicYearService();

// GET /
router.get('/', async (req, res) => {
  try {
    const {page, limit, search} = req.query;
    const query = {school: req?.user?.school};
    query.name = {$regex: new RegExp(search, 'i')};

    const academicYears = await academicYearService.getAcademicYears(page, limit, query);
    res.json(academicYears);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// POST /
router.post(
  '/',
  [
    body('startDate').isISO8601().toDate(),
    body('endDate').isISO8601().toDate(),
    body().custom(async (value, {req}) => {
      const {startDate, endDate} = req.body;
      console.log({startDate, endDate});

      // Query to check if there are any overlapping academic years for the same school
      const overlappingAcademicYears = await academicYearService.hasAcademicYearOnSamePeriod({
        startDate,
        endDate,
        school: req?.user?.school,
      });

      if (overlappingAcademicYears.length > 0) {
        throw new Error('Academic year period overlaps with existing academic year');
      }

      // Validation passed
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({errors: errors.array()});
    }
    try {
      const academicYearData = req.body;
      const data = {...academicYearData, school: req?.user?.school};
      // if()
      console.log(data);
      const createdAcademicYear = await academicYearService.createAcademicYear(data);
      res.status(201).json(createdAcademicYear);
    } catch (error) {
      res.status(404).json({error: error.message});
    }
  },
);
// POST /
router.put(
  '/:id',
  [
    body('startDate').isISO8601().toDate(),
    body('endDate').isISO8601().toDate(),
    body().custom(async (value, {req}) => {
      const {startDate, endDate} = req.body;
      console.log({startDate, endDate});

      // Query to check if there are any overlapping academic years for the same school
      // const overlappingAcademicYears = await academicYearService.hasAcademicYearOnSamePeriod({
      //   startDate,
      //   endDate,
      //   school: req?.user?.school,
      // });
      // console.log(overlappingAcademicYears);
      // if (overlappingAcademicYears.length > 0) {
      //   throw new Error('Academic year period overlaps with existing academic year');
      // }

      // Validation passed
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({errors: errors.array()});
    }
    try {
      const academicYearData = req.body;
      const {id} = req.params;
      const data = {...academicYearData, school: req?.user?.school};
      // if()
      console.log(data);
      const updatedAcademicYear = await academicYearService.updateAcademicYear(id, data);
      res.status(201).json(updatedAcademicYear);
    } catch (error) {
      res.status(404).json({error: error.message});
    }
  },
);

// DELETE /
router.delete(
  '/:id',
  [
    body().custom(async (value, {req}) => {
      const {id} = req.params;

      // Query to check if there are any overlapping academic years for the same school
      const overlappingAcademicYears = await academicYearService.getAcademicYear(id);
      if (!overlappingAcademicYears) {
        throw new Error('Academic year not found');
      }
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(404).json({errors: errors.array()});
    }
    try {
      const {id} = req.params;
      const deletedAcademicYear = await academicYearService.deleteAcademicYear(id);
      res.json(deletedAcademicYear);
    } catch (error) {
      res.status(404).json({error: error.message});
    }
  },
);

module.exports = router;
