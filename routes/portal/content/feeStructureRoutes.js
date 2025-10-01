const express = require('express');
const router = express.Router();
const {
  createFeeStructure,
  getFeeStructures,
  getFeeStructureById,
  updateFeeStructure,
  deleteFeeStructure,
} = require('../../../controllers/portal/content/feeStructureController');
const { auth } = require('../../../middleware/portal-auth');

router.route('/')
  .post(auth, createFeeStructure)
  .get(auth, getFeeStructures);

router.route('/:id')
  .get(auth, getFeeStructureById)
  .put(auth, updateFeeStructure)
  .delete(auth, deleteFeeStructure);

module.exports = router;
