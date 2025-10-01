const mongoose = require("mongoose");
const permissionsSchema = new mongoose.Schema({
  role: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Role",
    required: true,
  },
  module: {
    type: String,
    required: true,
    unique: true,
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
permissionsSchema.index(
  { role: 1, module: 1 },
  { unique: true, partialFilterExpression: { terminated: false } }
);
module.exports = mongoose.model("Permission", permissionsSchema);
