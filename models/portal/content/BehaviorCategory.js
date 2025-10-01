// models/BehaviorCategory.js

const mongoose = require('mongoose');

const behaviorCategorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  school: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'school',
    required: true,
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
  EE: {type: String, default: 'Demonstrates behavior above the expected level consistently.'},

  ME: {type: String, default: 'Demonstrates behavior at the expected level regularly.'},

  AE: {type: String, default: 'Demonstrates behavior slightly below the expected level occasionally.'},

  BE: {type: String, default: 'Rarely demonstrates behavior at the expected level.'},
});

module.exports = mongoose.model('BehaviorCategory', behaviorCategorySchema);
