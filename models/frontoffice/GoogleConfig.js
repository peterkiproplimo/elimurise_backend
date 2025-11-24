const mongoose = require('mongoose');

const googleConfigSchema = new mongoose.Schema({
  client_id: {
    type: String,
    required: true,
    trim: true
  },
  client_secret: {
    type: String,
    required: true,
    trim: true
  },
  api_key: {
    type: String,
    required: false,
    trim: true
  },
  refresh_token: {
    type: String,
    required: false,
    trim: true
  },
  access_token: {
    type: String,
    required: false,
    trim: true
  },
  code: {
    type: String,
    required: false,
    trim: true
  },
  redirect_uri: {
    type: String,
    required: false,
    trim: true
  },
  scope: {
    type: String,
    required: false,
    trim: true,
    default: 'https://www.googleapis.com/auth/drive.file'
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
googleConfigSchema.index({ is_active: 1 });

// Ensure only one active configuration
googleConfigSchema.pre('save', async function(next) {
  if (this.is_active) {
    // Deactivate all other configurations
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { is_active: false }
    );
  }
  next();
});

module.exports = mongoose.model('GoogleConfig', googleConfigSchema);
