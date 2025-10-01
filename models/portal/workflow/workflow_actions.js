const mongoose = require("mongoose");

const workflow_actions = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

module.exports = mongoose.model("WorkflowAction", workflow_actions);
