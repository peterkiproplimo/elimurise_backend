const mongoose = require('mongoose');
const PackageSchema = new mongoose.Schema({
  name: {type: String, required: true, unique: true},
  description: {type: String, required: true},
  pricePerLearner: {type: Number, required: true},
  duration: {type: Number, required: true, default: 1},
  color: {type: String, required: true, default: 1},
});
const Package = mongoose.model('Package', PackageSchema);
module.exports = Package;
