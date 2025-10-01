const mongoose = require('mongoose');
const {faker} = require('@faker-js/faker');
const Modules = require('../models/cms/auth/module'); // Replace with the path to your user model
const bcrypt = require('bcryptjs');
const WorkflowState = require('../models/cms/workflow/workflow_states');
const WorkflowAction = require('../models/cms/workflow/workflow_actions');
const Workflow = require('../models/cms/workflow/workflows');
const Role = require('../models/cms/auth/roles');
const PortalRole = require('../models/portal/auth/roles');

require('dotenv').config();
// Function to seed users
const AVAILABLE_MODULES = [
  {
    name: 'dashboard',
    description: 'Dashboard',
  },
  {
    name: 'portal',
    description: 'Portal Information',
  },
  {
    name: 'users',
    description: 'Users',
  },
  {
    name: 'grades',
    description: 'Grades',
  },
  {
    name: 'level',
    description: 'Levels',
  },
  {
    name: 'learning-areas',
    description: 'Learning Areas',
  },
  {
    name: 'strand',
    description: 'Strands',
  },
  {
    name: 'substrand',
    description: 'Substrands',
  },
  {
    name: 'roles',
    description: 'Roles',
  },
  {
    name: 'grade-user-assignment',
    description: 'Learning Area Assignment',
  },
  {
    name: 'package',
    description: 'Pricing Package',
  },
  {
    name: 'descriptor',
    description: 'Descriptors',
  },
  {
    name: 'grading-system',
    description: 'Performance Level Scale',
  },
];
const seedModules = async () => {
  for (const mod of AVAILABLE_MODULES) {
    try {
      const existingModule = await Modules.findOne({...mod});
      const existingModuleByname = await Modules.findOne({
        description: mod.description,
      });
      if (!existingModule && !existingModuleByname) {
        await Modules.create({...mod});
      } else if (existingModuleByname) {
        await Modules.findOneAndUpdate({_id: existingModuleByname._id}, {$set: mod});
      } else {
        // If the module exists, update its details
        await Modules.findOneAndUpdate({name: mod.name}, {$set: mod});
      }
    } catch (err) {
      console.log(err.message);
    }
  }
};

seedModules();
// const getRandomId = async Model => {
//   const count = await Model.countDocuments();
//   const randomIndex = Math.floor(Math.random() * count);
//   const randomDocument = await Model.findOne().skip(randomIndex);
//   return randomDocument._id;
// };

// // Define all permissions for each module
// const modulePermissions = {
//   meta: ['read', 'create', 'update', 'delete'],
//   behaviour: ['read', 'create', 'update', 'delete', 'assess'],
//   'grading-scale': ['read', 'create', 'update', 'delete'],
//   auth: ['read', 'create', 'update', 'delete'],
//   subscription: ['read', 'create', 'update', 'delete'],
//   teachers: ['read', 'create', 'update', 'delete', 'bulky-import', 'assign-grade'],
//   learners: ['read', 'create', 'update', 'delete', 'history', 'bulk-import', 'change-status'],
//   streams: ['read', 'create', 'update', 'delete'],
//   enrollment: ['read', 'create', 'update', 'promote'],
//   parents: ['read', 'create', 'update', 'delete', 'bulky-import'],
//   assessment: ['create', 'read', 'assess', 'publish', 'learners-report', 'analysis-report'],
//   'learning-areas': ['read', 'create', 'update', 'delete'],
//   strand: ['read', 'create', 'update', 'delete'],
//   substrand: ['read', 'create', 'update', 'delete'],
//   users: ['read', 'create', 'update', 'delete', 'update-profile', 'deactivate', 'activate'],
//   roles: ['read', 'create', 'update', 'delete'],
//   school: ['read', 'create', 'update', 'delete'],
//   'grade-teacher-assignment': ['read', 'create', 'update', 'delete'],
//   tests: ['read', 'create', 'update', 'delete', 'assess', 'learners-report', 'analysis-report'],
//   'grading-system': ['read', 'create', 'update', 'delete'],
//   grades: ['read', 'create', 'update', 'delete'],
//   dashboard: ['read', 'view-stats'],
//   'transfer-requests': ['read', 'create', 'update', 'delete', 'approve'],
//   payments: ['read', 'create', 'process', 'delete'],
//   comment: ['read', 'create'],
// };

// const seedRoles = async () => {
//   try {
//     // Connect to your MongoDB database

//     console.log('Connected to database');

//     // Define permissions for each role
//     const rolesToSeed = [
//       {
//         name: 'Super Admin',
//         permissions: modulePermissions, // Assign all permissions
//       },
//       {
//         name: 'Facilitator',
//         permissions: {
//           // meta: ['read', 'create', 'update', 'delete'],
//           behaviour: ['read', 'create', 'assess'],
//           'grading-scale': ['read'],
//           learners: ['read', 'history', 'bulk-import', 'change-status'],
//           streams: ['read'],
//           enrollment: ['read', 'create', 'update', 'promote'],
//           assessment: ['create', 'read', 'assess', 'publish', 'learners-report', 'analysis-report'],
//           'learning-areas': ['read'],
//           strand: ['read'],
//           substrand: ['read'],
//           tests: ['read', 'assess', 'learners-report', 'analysis-report'],
//           'grading-system': ['read'],
//           grades: ['read'],
//           dashboard: ['read', 'view-stats'],
//           'transfer-requests': ['read'],
//           comment: ['read', 'create'],
//         },
//       },
//       {
//         name: 'Class Manager',
//         permissions: {
//           users: ['read'],
//           streams: ['read', 'create', 'update'],
//           grades: ['read', 'create', 'update'],
//           assessment: ['read', 'create'],
//         },
//       },

//       {
//         name: 'H/Teacher',
//         permissions: {
//           teachers: ['read', 'create', 'update', 'delete'],
//           learners: ['read', 'update'],
//           streams: ['read', 'create', 'update', 'delete'],
//           assessment: ['read', 'update'],
//         },
//       },
//       {
//         name: 'Subject Lead',
//         permissions: {
//           'learning-areas': ['read', 'create', 'update'],
//           strand: ['read', 'create', 'update'],
//           substrand: ['read', 'create', 'update'],
//           assessment: ['read', 'create', 'update'],
//         },
//       },
//       {
//         name: 'C Coodinator',
//         permissions: {
//           'grade-teacher-assignment': ['read', 'create', 'update', 'delete'],
//           learners: ['read', 'update'],
//           teachers: ['read', 'update'],
//           school: ['read', 'update'],
//         },
//       },

//       {
//         name: 'D/Head Teacher',
//         permissions: {
//           teachers: ['read', 'update', 'delete'],
//           learners: ['read', 'update', 'delete'],
//           enrollment: ['read', 'update', 'delete'],
//           school: ['read', 'update', 'delete'],
//         },
//       },
//     ];

//     // Loop through roles and seed or update them
//     for (const roleData of rolesToSeed) {
//       let role = await PortalRole.findOne({name: roleData.name});

//       if (role) {
//         // Update role permissions if different
//         const permissionsChanged = JSON.stringify(role.permissions) !== JSON.stringify(roleData.permissions);
//         if (permissionsChanged) {
//           role.permissions = roleData.permissions;
//           await role.save();
//           console.log(`${roleData.name} role updated successfully`);
//         } else {
//           console.log(`${roleData.name} role is already up-to-date`);
//         }
//       } else {
//         // Create new role
//         role = new PortalRole(roleData);
//         await role.save();
//         console.log(`${roleData.name} role created successfully`);
//       }
//     }

//     // Close the database connection
//   } catch (error) {
//     console.error('Error seeding roles:', error);
//   }
// };

// // Execute the script
// seedRoles();
