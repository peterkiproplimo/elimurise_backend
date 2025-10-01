const express = require('express');
const router = express.Router();
const LessonProgressService = require('../../../services/portal/AsessmentProgress');

const lessonProgressService = new LessonProgressService();

// GET /
router.get('/', async (req, res) => {
  try {
    const {page, limit, search} = req.query;
    const lessonProgresses = await lessonProgressService.getLessonProgresses(page, limit, search);
    res.json(lessonProgresses);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// POST /
router.post('/', async (req, res) => {
  try {
    const lessonProgressData = req.body;
    const createdLessonProgress = await lessonProgressService.createLessonProgress(lessonProgressData);
    res.status(201).json(createdLessonProgress);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// PUT /:id
router.put('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const lessonProgressData = req.body;
    const updatedLessonProgress = await lessonProgressService.updateLessonProgress(id, lessonProgressData);
    res.json(updatedLessonProgress);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// DELETE /:id
router.delete('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const deletedLessonProgress = await lessonProgressService.deleteLessonProgress(id);
    res.json(deletedLessonProgress);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
