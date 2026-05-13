const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: [true, "Issue reference is required"],
      index: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    commentText: {
      type: String,
      required: [true, "Comment text is required"],
      trim: true,
    },
  },
  { timestamps: true }
);

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;
