const logger = require('../utils/logger');
const Permissions = require('../models/cms/auth/Permissions');
const Role = require('../models/cms/auth/roles');
const workflowService = require('../services/cms/WorkflowService');
const Module = require('../models/cms/auth/module');
const {AVAILABLE_MODULES, isModuleAvailable, getOperation, OPERATION} = require('../utils/modules');
const intercept = async (req, res, next) => {
  // Your middleware logic here

  try {
    const app = req.path.split('/')[1];
    const module = req.path.split('/')[1];
    const module_id = await Module.findOne({name: module});

    const operation = getOperation(req.method);
    const role_id = req.user.role_id;

    const role = await Role.findOne({_id: role_id});
    if (!module_id) {
      logger.error(`please register module ${module} in utils/modules if you believe this is not a typo`);
      return res.status(401).json({
        success: false,
        error: `Your role ${role.name} does not have ${operation} permissions on ${module} `,
      });
    }
    const content_assignments = await Module.findOne({name: 'grade-user-assignment'});
    const cperm = role?.permissions.filter(p => p.module.equals(content_assignments._id));

    req.superAdmin = cperm[0][operation];
    const perm = role?.permissions.filter(p => p.module.equals(module_id._id));

    if (perm.length === 0) {
      return res.status(401).json({
        success: false,
        error: `Your role ${role.name} does not have ${operation} permissions on ${module.description} `,
      });
    } else {
      const hasPermission = perm[0][operation];

      if (!hasPermission && req.method != 'PATCH') {
        return res.status(401).json({
          success: false,
          error: `Your role ${role.name} does not have ${operation} permissions on ${module.description} `,
        });
      } else {
        // const workflow = await workflowService.getWorkflowByModule(module_id);

        // if (workflow) {
        //   //.... do workflow operation
        //   if (operation == OPERATION.CREATE) {
        //     const workflow_state = workflow.states[0]._id;
        //     const doc_status = workflow.states[0].doc_status;
        //     req.body.workflow_state = workflow_state;
        //     req.body.status = doc_status;
        //   } else {
        //     req.body.module = module_id._id;
        //   }
        // }

        next();
      }
    }
  } catch (error) {
    // console.log(error.message);
    const role_id = req.user.role_id;

    const role = await Role.findOne({_id: role_id});
    return res.status(404).json({
      success: false,
      user: req.user,
      role: role,
      error: 'Internal Server Error  ' + error.message,
      module: req.path.split('/'),
      perm: await Module.findOne({name: req.path.split('/')[1]}),
    });
  }
};

module.exports = intercept;
