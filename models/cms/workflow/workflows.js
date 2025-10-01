const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const workflow = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    module: {
      type: Schema.Types.ObjectId,
      ref: "Modules",
      required: true,
      unique: true,
    },
    active: {
      type: Boolean,
      default: false,
    },
    notify: {
      type: Boolean,
      default: true,
    },
    states: [
      {
        state: {
          type: Schema.Types.ObjectId,
          ref: "WorkflowState",
          required: true,
        },
        doc_status: {
          type: Number,
          required: true,
        },
        allowed_edit_for: {
          type: Schema.Types.ObjectId,
          ref: "Role",
          required: true,
        },
      },
    ],
    transition_rules: [
      {
        state: {
          type: Schema.Types.ObjectId,
          ref: "WorkflowState",
          required: true,
        },
        action: {
          type: Schema.Types.ObjectId,
          ref: "WorkflowAction",
          required: true,
        },
        next_state: {
          type: Schema.Types.ObjectId,
          ref: "WorkflowState",
          required: true,
        },
        allowed: {
          type: Schema.Types.ObjectId,
          ref: "Role",
          required: true,
        },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Workflow", workflow);
