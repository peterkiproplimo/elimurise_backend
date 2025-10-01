const mongoose = require('mongoose');

const workflow_states = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
});

// module.exports = mongoose.model("WorkflowState", workflow_states);
