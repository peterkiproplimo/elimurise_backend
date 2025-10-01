const mongoose = require('mongoose');

// Define the schema for exam grading descriptors
const plDescriptorSchema = new mongoose.Schema({
  mark: {
    type: Number,
    max: 100,
    min: 0,
  },
  score: {
    type: Number,
    required: true,
    max: 4,
    min: 0,
  },
  description: {
    type: String,
    required: true,
  },
  description_swahili: {
    type: String,
    required: true,
  },
});
plDescriptorSchema.statics.findByScore = async function (score) {
  if (![4, 3, 2, 1].includes(score)) {
    throw new Error('Invalid score. Score must be 4, 3, 2, or 1.');
  }
  return this.findOne({score});
};

// Create the model using the defined schema
const plDescriptor = mongoose.model('plDescriptor', plDescriptorSchema);

// Export the model for use in other parts of the application
module.exports = plDescriptor;
