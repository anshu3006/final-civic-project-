const mongoose = require("mongoose");

const issueSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
    },
    locationText: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['Critical', 'High', 'Medium', 'Low', 'None'],
      default: 'None',
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
    },
    department: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String, // Cloudinary URL stored as a plain string
      trim: true,
    },
    predictedIssueType:{
      type: String,
      trim: true,
    },
    severityScore: {
      type: Number,
      min: 1,
      max: 10,
    },
    impactScope: {
      type: String,
      enum: ["Individual", "Locality", "Ward", "City-wide"],
    },
    urgency: {
      type: String,
      enum: ["Immediate", "Within 24hrs", "Within a Week", "Routine"],
    },
    priorityScore: {
      type: Number,
      min: 1,
      max: 100,
    },
    suggestedDepartment: {
      type: String,
      enum: [
        "Electrical",
        "Plumbing",
        "Civil",
        "Housekeeping",
        "Lift",
        "Security",
        "Other",
      ],
      trim: true,
    },
    estimatedResolution: {
      type: String,
      enum: [
        "Same Day",
        "1-3 Days",
        "1 Week",
        "2-4 Weeks",
        "Long-term Project",
      ],
    },
    upvotes: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    status: {
      type: String,
      enum: ["reported", "approved", "in_progress", "resolved"],
      default: "reported",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: upvoteCount derived from upvotes array length
issueSchema.virtual("upvoteCount").get(function () {
  return this.upvotes ? this.upvotes.length : 0;
});

// Indexes
issueSchema.index({ status: 1 });
issueSchema.index({ severityScore: -1 });
issueSchema.index({ priorityScore: -1 });
issueSchema.index({ createdAt: -1 });

// Pre-save: if status is set to "resolved", ensure severityScore exists
issueSchema.pre("save", function (next) {
  if (this.status === "resolved" && (this.severityScore == null)) {
    throw new Error(
      "Cannot resolve an issue without a severity score"
    );
  }

  for (const fieldName of ["severityScore", "priorityScore"]) {
    if (this[fieldName] != null && !Number.isInteger(this[fieldName])) {
      throw new Error(`${fieldName} must be an integer`);
    }
  }

  next();
});

const Issue = mongoose.model("Issue", issueSchema);
module.exports = Issue;
