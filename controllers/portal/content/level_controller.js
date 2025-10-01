const logger = require('../../../utils/logger');
const Level = require('../../../models/cms/content/level');

const PAGE_SIZE = 10;
const Joi = require('joi');
const express = require('express');
const mongoose = require('mongoose');
const Grade = require('../../../models/cms/content/grade');

const router = express.Router();

// Validation schema using Joi
// const levelSchema = Joi.object({
//   _id: Joi.string(),
// name: Joi.string().required(),
//   status: Joi.number().valid(0, 1, 2).default(0),
// });

// Create Level
router.post('/', async (req, res) => {
  try {
    // const { error } = levelSchema.validate(req.body);
    // if (error) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: error.details[0].message });
    // }
    const newLevel = await Level.create(req.body);
    return res.status(201).json({success: true, data: newLevel, message: 'Created Successfully'});
  } catch (err) {
    logger.error(`Error creating level: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to save  duplicate entry'});
  }
});

router.put('/', async (req, res) => {
  try {
    // const { error } = levelSchema.validate(req.body);
    // if (error) {
    //   return res
    //     .status(404)
    //     .json({ success: false, message: error.details[0].message });
    // }
    const id = req.body._id;
    const {name} = {...req.body};
    console.log(id);
    const newLevel = await Level.findByIdAndUpdate(id, {name}, {new: true});
    return res.status(201).json({success: true, data: newLevel, message: 'Updated Successfully'});
  } catch (err) {
    logger.error(`Error creating level: ${err.message}`);
    res.status(404).json({success: false, message: 'Failed to save'});
  }
});

// List Levels

router.get('/', async (req, res) => {
  try {
    const levelsList = await Level.find();

    return res.status(200).json({
      success: true,
      data: levelsList,
    });
  } catch (error) {
    logger.error(`Failed to fetch levels: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

// Delete Level
router.delete('/:levelId', async (req, res) => {
  try {
    const {levelId} = req.params;
    const grade = await Grade.find({level_id: levelId});
    if (grade.length > 0) {
      return res.status(404).json({
        success: false,
        error: 'Level is linked to a Grade',
      });
    }
    const deletedLevel = await Level.findOneAndDelete({_id: levelId});

    if (deletedLevel) {
      res.status(200).json({
        success: true,
        data: deletedLevel,
        message: 'Deleted Successfully',
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No record found to delete',
      });
    }
  } catch (error) {
    logger.error(`Failed to delete level: ${error.message}`);
    res.status(404).json({success: false, message: 'Internal Server Error'});
  }
});

module.exports = router;
