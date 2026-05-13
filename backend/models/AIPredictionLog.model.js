const mongoose = require("mongoose");

const aiPredictionLogSchema = new mongoose.Schema(
  {
    issue: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: [true, "Issue reference is required"],
      unique: true, // one prediction log per issue
    },
    modelVersion: {
      type: String,
      required: [true, "Model version is required"],
      trim: true,
    },
    predictedIssueType: {
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
    description: {
      type: String,
      trim: true,
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
    },
  },
  { timestamps: true }
);

// Pre-save: validate confidenceScore is between 0 and 1 if provided
aiPredictionLogSchema.pre("save", function (next) {
  if (
    this.confidenceScore != null &&
    (this.confidenceScore < 0 || this.confidenceScore > 1)
  ) {
    throw new Error("Confidence score must be between 0 and 1");
  }

  for (const fieldName of ["severityScore", "priorityScore"]) {
    if (this[fieldName] != null && !Number.isInteger(this[fieldName])) {
      throw new Error(`${fieldName} must be an integer`);
    }
  }

  next();
});

const AIPredictionLog = mongoose.model(
  "AIPredictionLog",
  aiPredictionLogSchema
);
module.exports = AIPredictionLog;
