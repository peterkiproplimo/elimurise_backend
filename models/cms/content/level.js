const mongoose = require("mongoose");
const levelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    status: {
      type: Number,

      default: 0,
    },
  },
  {
    timestamps: true,
  }
);
const Level = mongoose.model("levels", levelSchema);
module.exports = Level;
