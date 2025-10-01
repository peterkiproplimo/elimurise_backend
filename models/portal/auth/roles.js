const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// Define permissions for each module (based on your routes)
const modulePermissions = {
  meta: ['read', 'create', 'update', 'delete'],
  behaviour: ['read', 'create', 'update', 'delete'],
  'grading-scale': ['read', 'create', 'update', 'delete'],
  auth: ['read', 'create', 'update', 'delete'],
  subscription: ['read', 'create', 'update', 'delete'],
  teachers: ['read', 'create', 'update', 'delete'],
  learners: ['read', 'create', 'update', 'delete'],
  streams: ['read', 'create', 'update', 'delete'],
  enrollment: ['read', 'create', 'update', 'delete'],
  parents: ['read', 'create', 'update', 'delete'],
  assessment: ['read', 'create', 'update', 'delete'],
  'learning-areas': ['read', 'create', 'update', 'delete'],
  strand: ['read', 'create', 'update', 'delete'],
  substrand: ['read', 'create', 'update', 'delete'],
  users: ['read', 'create', 'update', 'delete'],
  roles: ['read', 'create', 'update', 'delete'],
  school: ['read', 'create', 'update', 'delete'],
  'grade-teacher-assignment': ['read', 'create', 'update', 'delete'],
  tests: ['read', 'create', 'update', 'delete'],
  'grading-system': ['read', 'create', 'update', 'delete'],
  summative: ['read', 'create', 'update', 'delete'],
  grades: ['read', 'create', 'update', 'delete'],
  dashboard: ['read', 'view-stats'],
  'transfer-requests': ['read', 'create', 'update', 'delete'],
  payments: ['read', 'create', 'process', 'delete'],
  comment: ['read', 'create', 'update', 'delete'],
  // Added fees module permissions
  fees: ['read', 'write', 'manage', 'process']
};

// Role Schema with module-based permissions
const roleSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  permissions: {
    type: Map,
    of: [String], // Each key represents a module, and its value is an array of permissions
    default: () => {
      const defaultPermissions = {};
      Object.keys(modulePermissions).forEach(module => {
        defaultPermissions[module] = []; // Empty permissions by default
      });
      return defaultPermissions;
    },
  },
});

const PortalRole = mongoose.model('PortalRole', roleSchema);
module.exports = PortalRole;