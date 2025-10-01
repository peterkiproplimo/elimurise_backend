const express = require('express');
const router = express.Router();
const Lesson = require('../../../models/cms/content/Lesson'); // Adjust if path differs

// GET all lessons (with optional pagination & filtering)
router.get('/', async (req, res) => {
  try {
    const {page = 1, limit = 20, substrand} = req.query;
    const query = {};
    if (substrand) query.substrand = substrand;

    const total = await Lesson.countDocuments(query);
    const lessons = await Lesson.find(query)
      .populate('substrand')
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .sort({lesson_number: 1});

    return res.json({
      data: lessons,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// GET a single lesson
router.get('/:id', async (req, res) => {
  try {
    const lesson = await Lesson.findById(req.params.id).populate('substrand');
    if (!lesson) return res.status(404).json({error: 'Lesson not found'});
    res.json(lesson);
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

// CREATE a lesson
router.post('/', async (req, res) => {
  try {
    const newLesson = await Lesson.create(req.body);
    res.status(201).json(newLesson);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
});

// UPDATE a lesson
router.put('/:id', async (req, res) => {
  try {
    const updatedLesson = await Lesson.findByIdAndUpdate(req.params.id, req.body, {new: true});
    if (!updatedLesson) return res.status(404).json({error: 'Lesson not found'});
    res.json(updatedLesson);
  } catch (err) {
    res.status(400).json({error: err.message});
  }
});

// DELETE a lesson
router.delete('/:id', async (req, res) => {
  try {
    const deletedLesson = await Lesson.findByIdAndDelete(req.params.id);
    if (!deletedLesson) return res.status(404).json({error: 'Lesson not found'});
    res.json({message: 'Lesson deleted successfully'});
  } catch (err) {
    res.status(500).json({error: err.message});
  }
});

module.exports = router;
