const mongoose = require('mongoose');

const feeStructureItemSchema = new mongoose.Schema({
  feeItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'FeeItem',
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: [0.01, 'Amount must be greater than 0'],
  },
}, {_id: false});

const feeStructureSchema = new mongoose.Schema(
  {
    school: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'School',
      required: true,
    },
    academicYear: {
      type: String,
      required: true,
    },
    term: {
      type: String,
      required: true,
    },
    classLevel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Grade',
      required: true,
    },
    items: {
      type: [feeStructureItemSchema],
      required: true,
      validate: {
        validator: function(items) {
          return items.length > 0;
        },
        message: 'At least one fee item is required'
      }
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

feeStructureSchema.index({ school: 1, academicYear: 1, term: 1, classLevel: 1 }, { unique: true });

// Add validation middleware to ensure all item amounts are positive
feeStructureSchema.pre('save', function(next) {
  for (let item of this.items) {
    if (item.amount <= 0) {
      next(new Error('All item amounts must be greater than 0'));
      return;
    }
  }
  next();
});

const FeeStructure = mongoose.model('FeeStructure', feeStructureSchema);
module.exports = FeeStructure;
