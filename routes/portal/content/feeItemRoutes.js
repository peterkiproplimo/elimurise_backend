const express = require('express');
const router = express.Router();
const {
  createFeeItem,
  getFeeItems,
  getFeeItemById,
  updateFeeItem,
  deleteFeeItem,
} = require('../../../controllers/portal/content/feeItemController');
const { auth } = require('../../../middleware/portal-auth');

router.route('/')
  .post(auth, createFeeItem)
  .get(auth, getFeeItems);

router.route('/:id')
  .get(auth, getFeeItemById)
  .put(auth, updateFeeItem)
  .delete(auth, deleteFeeItem);

module.exports = router;
