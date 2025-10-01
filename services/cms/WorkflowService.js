const Workflow = require("../../models/cms/workflow/workflows");

const workflowService = {
  getAllWorkflows: async () => {
    try {
      const workflows = await Workflow.find().populate(
        "module states.state states.allowed_edit_for states.state transition_rules.state transition_rules.action transition_rules.next_state transition_rules.allowed"
      );
      return workflows;
    } catch (err) {
      throw new Error(err.message);
    }
  },

  getWorkflowById: async (id) => {
    try {
      const workflow = await Workflow.findById(id).populate(
        "module states.state states.allowed_edit_for states.state transition_rules.state transition_rules.action transition_rules.next_state transition_rules.allowed"
      );
      if (!workflow) {
        throw new Error("Workflow not found");
      }
      return workflow;
    } catch (err) {
      throw new Error(err.message);
    }
  },
  getWorkflowByModule: async (module) => {
    const workflow = await Workflow.findOne({ module: module }).populate(
      "module states.state states.allowed_edit_for states.state transition_rules.state transition_rules.action transition_rules.next_state transition_rules.allowed"
    );

    return workflow;
  },

  createWorkflow: async (workflowData) => {
    try {
      const newWorkflow = new Workflow(workflowData);
      const savedWorkflow = await newWorkflow.save();
      return savedWorkflow;
    } catch (err) {
      throw new Error(err.message);
    }
  },

  updateWorkflow: async (id, updateData) => {
    try {
      const updatedWorkflow = await Workflow.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate(
        "module states.state states.allowed_edit_for states.state transition_rules.state transition_rules.action transition_rules.next_state transition_rules.allowed"
      );
      if (!updatedWorkflow) {
        throw new Error("Workflow not found");
      }
      return updatedWorkflow;
    } catch (err) {
      throw new Error(err.message);
    }
  },

  deleteWorkflow: async (id) => {
    try {
      const deletedWorkflow = await Workflow.findByIdAndDelete(id);
      if (!deletedWorkflow) {
        throw new Error("Workflow not found");
      }
      return { message: "Workflow deleted" };
    } catch (err) {
      throw new Error(err.message);
    }
  },
};

module.exports = workflowService;
