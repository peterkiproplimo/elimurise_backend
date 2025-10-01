const mongoose = require('mongoose');

const feeItemSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Fee item name is required'] 
  },
  description: { 
    type: String 
  },
  defaultAmount: { 
    type: Number, 
    required: [true, 'Default amount is required'],
    min: [0.01, 'Default amount must be greater than 0']
  },
  mandatory: { 
    type: Boolean, 
    default: true 
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'School',
    required: true
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add index for unique fee item names per school
feeItemSchema.index({ name: 1, school: 1 }, { unique: true });

// Pre-save hook to ensure default amount is positive
feeItemSchema.pre('save', function(next) {
  if (this.defaultAmount <= 0) {
    throw new Error('Default amount must be greater than 0');
  }
  next();
});

const FeeItem = mongoose.model('FeeItem', feeItemSchema);
module.exports = FeeItem;
