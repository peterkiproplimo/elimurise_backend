const express = require('express');
const router = express.Router();
const StreamService = require('../../../services/portal/StreamService');
const {body, validationResult} = require('express-validator');
const Grade = require('../../../models/cms/content/grade');
const {checkPermission} = require('../../../middleware/portal-auth');
const streamService = new StreamService();

// GET /streams
router.get('/', checkPermission('streams', 'read'), async (req, res) => {
  try {
    const {grade} = req.query;
    // if (grade) {
    //   const streams = await streamService.getStreamByGrade({grade, school: req?.user?.school._id});
    //   return res.json({data: streams});
    // }
    const {page, search} = req.query;
    const limit = 1000;
    const query = {name: {$regex: new RegExp(search, 'i')}};

    if (grade) {
      query.grade = grade;
    }
    query.school = req?.user?.school._id;
    const streams = await streamService.getStreams(page, limit, query);
    res.json(streams);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});
// router.get('/', async (req, res) => {
//   try {
//     const streams = await streamService.getStreamByGrade(grade);
//     return res.json(streams);
//   } catch (error) {
//     res.status(404).json({error: error.message});
//   }
// });

// POST /streams
router.post(
  '/',
  checkPermission('streams', 'create'),
  [
    body('grade')
      .notEmpty()
      .withMessage('Grade is required')
      .custom(async value => {
        const isUnique = await Grade.findById(value);
        if (!isUnique) {
          throw new Error('Grade not found or has been deleted');
        }
        return true;
      }),
    body('name').notEmpty().withMessage('Name is required'),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(404).json({errors: errors.array()});
      }

      const isUnique = await streamService.isStreamNameUniqueGrade(req.body.name, req.body.grade, req?.user?.school);
      if (!isUnique) {
        throw new Error('Name must be unique');
      }

      // If validation passes, proceed with creating the stream
      const streamData = {...req.body, school: req?.user?.school};

      const createdStream = await streamService.createStream(streamData);
      res.status(201).json(createdStream);
    } catch (error) {
      console.log(error);
      res.status(404).json({error: error.message});
    }
  },
);

// PUT /streams/:id
router.put('/:id', checkPermission('streams', 'update'), async (req, res) => {
  try {
    const {id} = req.params;
    const streamData = req.body;
    const updatedStream = await streamService.updateStream(id, streamData);
    res.json(updatedStream);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// DELETE /streams/:id
router.delete('/:id', checkPermission('streams', 'delete'), async (req, res) => {
  try {
    const {id} = req.params;
    const deletedStream = await streamService.deleteStream(id);
    if (!deletedStream) {
      throw Error('Stream Not found');
    }
    res.json(deletedStream);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

module.exports = router;
