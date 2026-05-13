const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    clerkUserId: {
      type: String,
      required: [true, "Clerk user ID is required"],
      unique: true,
      trim: true,
    },
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    role: {
      type: String,
      enum: ["resident", "admin"],
      default: "resident",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Indexes
userSchema.index({ role: 1 });

// Pre-save: enforce only ONE admin in the entire collection
userSchema.pre("save", async function (next) {
  if (this.role === "admin") {
    const existingAdmin = await mongoose.model("User").findOne({
      role: "admin",
      _id: { $ne: this._id },
    });
    if (existingAdmin) {
      throw new Error("Only one admin is allowed in the system");
    }
  }
  next();
});

const User = mongoose.model("User", userSchema);
module.exports = User;
