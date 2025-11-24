const mongoose = require('mongoose');

const cloudinaryConfigSchema = new mongoose.Schema({
  cloud_name: {
    type: String,
    required: true,
    trim: true
  },
  api_key: {
    type: String,
    required: true,
    trim: true
  },
  api_secret: {
    type: String,
    required: true,
    trim: true
  },
  upload_preset: {
    type: String,
    trim: true,
    default: ''
  },
  folder: {
    type: String,
    trim: true,
    default: 'project-evidences'
  },
  description: {
    type: String,
    trim: true,
    default: ''
  },
  is_active: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for active configuration
cloudinaryConfigSchema.index({ is_active: 1 });

// Ensure only one active configuration
cloudinaryConfigSchema.pre('save', async function(next) {
  if (this.is_active) {
    // Deactivate all other configurations
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { is_active: false }
    );
  }
  next();
});

module.exports = mongoose.model('CloudinaryConfig', cloudinaryConfigSchema);
