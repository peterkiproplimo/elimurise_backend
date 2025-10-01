const FeeStructure = require('../../../models/portal/content/FeeStructure');

// @desc    Create a new fee structure
// @route   POST /api/portal/fee-structures
// @access  Private
exports.createFeeStructure = async (req, res) => {
  try {
    const { academicYear, term, classLevel, items } = req.body;

    // Validate required fields
    if (!academicYear || !term || !classLevel) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'Academic year, term, and class level are required' 
      });
    }

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'At least one fee item is required' 
      });
    }

    // Validate each item has required fields
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.feeItemId || !item.amount) {
        return res.status(400).json({ 
          status: 'error', 
          message: `Item ${i + 1} must have feeItemId and amount` 
        });
      }
      if (item.amount <= 0) {
        return res.status(400).json({ 
          status: 'error', 
          message: `Item ${i + 1} amount must be greater than 0` 
        });
      }
    }

    const feeStructure = new FeeStructure({
      school: req.user.school,
      academicYear,
      term,
      classLevel,
      items,
    });

    await feeStructure.save();

    // Populate the grade information before returning
    await feeStructure.populate('classLevel', 'name level');

    res.status(201).json({
      status: 'success',
      message: 'Fee structure created successfully',
      data: feeStructure,
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A fee structure with this academic year, term, and class level already exists for your school' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Validation failed', 
        details: messages 
      });
    }
    
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// @desc    Get all fee structures for a school
// @route   GET /api/portal/fee-structures
// @access  Private
exports.getFeeStructures = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const feeStructures = await FeeStructure.find({ school: req.user.school })
      .populate('classLevel', 'name level')
      .populate('items.feeItemId', 'name category amount')
      .skip(skip)
      .limit(limit);
      
    const total = await FeeStructure.countDocuments({ school: req.user.school });
    
    res.status(200).json({
      status: 'success',
      data: feeStructures,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Get a single fee structure by ID
// @route   GET /api/portal/fee-structures/:id
// @access  Private
exports.getFeeStructureById = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findOne({ _id: req.params.id, school: req.user.school })
      .populate('classLevel', 'name level')
      .populate('items.feeItemId', 'name category amount');

    if (!feeStructure) {
      return res.status(404).json({ status: 'error', message: 'Fee structure not found' });
    }

    res.status(200).json({
      status: 'success',
      data: feeStructure,
    });
  } catch (error) {
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({ status: 'error', message: 'Invalid fee structure ID' });
    }
    
    res.status(500).json({ status: 'error', message: error.message });
  }
};

// @desc    Update a fee structure
// @route   PUT /api/portal/fee-structures/:id
// @access  Private
exports.updateFeeStructure = async (req, res) => {
  try {
    const { items } = req.body;
    
    // Validate items array if provided
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ 
          status: 'error', 
          message: 'At least one fee item is required' 
        });
      }
      
      // Validate each item has required fields
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.feeItemId || item.amount === undefined) {
          return res.status(400).json({ 
            status: 'error', 
            message: `Item ${i + 1} must have feeItemId and amount` 
          });
        }
        if (item.amount <= 0) {
          return res.status(400).json({ 
            status: 'error', 
            message: `Item ${i + 1} amount must be greater than 0` 
          });
        }
      }
    }

    const feeStructure = await FeeStructure.findOneAndUpdate(
      { _id: req.params.id, school: req.user.school },
      req.body,
      { new: true, runValidators: true }
    ).populate('classLevel', 'name level');

    if (!feeStructure) {
      return res.status(404).json({ status: 'error', message: 'Fee structure not found' });
    }

    res.status(200).json({
      status: 'success',
      message: 'Fee structure updated successfully',
      data: feeStructure,
    });
  } catch (error) {
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(400).json({ 
        status: 'error', 
        message: 'A fee structure with this academic year, term, and class level already exists for your school' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        status: 'error', 
        message: 'Validation failed',
        details: messages 
      });
    }
    
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({ status: 'error', message: 'Invalid fee structure ID' });
    }
    
    res.status(400).json({ status: 'error', message: error.message });
  }
};

// @desc    Delete a fee structure
// @route   DELETE /api/portal/fee-structures/:id
// @access  Private
exports.deleteFeeStructure = async (req, res) => {
  try {
    const feeStructure = await FeeStructure.findOneAndDelete({ _id: req.params.id, school: req.user.school });

    if (!feeStructure) {
      return res.status(404).json({ status: 'error', message: 'Fee structure not found' });
    }

    res.status(200).json({ status: 'success', message: 'Fee structure deleted successfully' });
  } catch (error) {
    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({ status: 'error', message: 'Invalid fee structure ID' });
    }
    
    res.status(500).json({ status: 'error', message: error.message });
  }
};
