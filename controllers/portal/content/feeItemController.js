const FeeItem = require('../../../models/portal/content/FeeItem');

// @desc    Create a new fee item
// @route   POST /api/portal/fee-items
// @access  Private
exports.createFeeItem = async (req, res) => {
  try {
    const { name, description, defaultAmount, mandatory } = req.body;

    const feeItem = new FeeItem({
      school: req.user.school, // From auth middleware
      name,
      description,
      defaultAmount,
      mandatory,
    });

    await feeItem.save();

    res.status(201).json({
      status: 'success',
      data: feeItem,
    });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// @desc    Get all fee items for a school
// @route   GET /api/portal/fee-items
// @access  Private
exports.getFeeItems = async (req, res) => {
  try {
    const feeItems = await FeeItem.find({ school: req.user.school });
    res.status(200).json({
      status: 'success',
      data: feeItems,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get a single fee item by ID
// @route   GET /api/portal/fee-items/:id
// @access  Private
exports.getFeeItemById = async (req, res) => {
  try {
    const feeItem = await FeeItem.findOne({ _id: req.params.id, school: req.user.school });

    if (!feeItem) {
      return res.status(404).json({ status: 'error', message: 'Fee item not found' });
    }

    res.status(200).json({
      status: 'success',
      data: feeItem,
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update a fee item
// @route   PUT /api/portal/fee-items/:id
// @access  Private
exports.updateFeeItem = async (req, res) => {
  try {
    const feeItem = await FeeItem.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      req.body,
      { new: true, runValidators: true }
    );

    if (!feeItem) {
      return res.status(404).json({ status: 'error', message: 'Fee item not found' });
    }

    res.status(200).json({
      status: 'success',
      data: feeItem,
    });
  } catch (error) {
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// @desc    Delete a fee item
// @route   DELETE /api/portal/fee-items/:id
// @access  Private
exports.deleteFeeItem = async (req, res) => {
  try {
    const feeItem = await FeeItem.findOneAndDelete({ _id: req.params.id, school: req.user.school });

    if (!feeItem) {
      return res.status(404).json({ status: 'error', message: 'Fee item not found' });
    }

    res.status(200).json({ status: 'success', message: 'Fee item deleted successfully' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};
