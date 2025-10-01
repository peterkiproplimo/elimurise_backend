const mongoose = require('mongoose');
const permissionsSchema = new mongoose.Schema({
  module: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Modules',
    required: true,
  },
  read: {
    type: Boolean,
    required: true,
    default: false,
  },
  write: {
    type: Boolean,
    required: true,
    default: false,
  },
  update: {
    type: Boolean,
    required: true,
    default: false,
  },
  delete: {
    type: Boolean,
    required: true,
    default: false,
  },
});

const roleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      unique: true,
      required: true,
    },
    permissions: [permissionsSchema],
  },
  {timestamps: true},
);

roleSchema.index({name: 1}, {unique: true, collation: {locale: 'en', strength: 2}});

const Role = mongoose.model('Role', roleSchema);
module.exports = Role;
