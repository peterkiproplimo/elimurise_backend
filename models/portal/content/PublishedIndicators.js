const {required} = require('joi');
const mongoose = require('mongoose');

// Define the Assessment schema
const publishedIndicatorsSchema = new mongoose.Schema({
  stream: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Stream',
    required: true,
  },
  term: {
    type: Number,
    enum: [1, 2, 3],

    required: true,
  },
  indicator: {
    type: mongoose.Schema.Types.ObjectId,

    required: true,
  },
  status: {
    type: String,
    enum: ['Published', 'Unpublished'],
    required: true,
  },
});
publishedIndicatorsSchema.index({term: 1, stream: 1, indicator: 1}, {unique: true});

// Define the Assessment model
const Assessment = mongoose.model('PublishedIndicators', publishedIndicatorsSchema);

module.exports = Assessment;
