import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "" },
    city: { type: String, default: "" },
    district: { type: String, default: "" },
    postalCode: { type: String, default: "" },
  },
  { _id: false }
);

const notificationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["order", "review", "offer", "system"],
      default: "system",
    },
    title: { type: String, default: "" },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    read: { type: Boolean, default: false },
    meta: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const sellerSocialSchema = new mongoose.Schema(
  {
    fbPageId: { type: String },
    fbAccessToken: { type: String, select: false },
    igUserId: { type: String },
    igAccessToken: { type: String, select: false },
  },
  { _id: false }
);

const cartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    addedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const purchaseHistorySchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, default: 1, min: 1 },
    purchasedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["buyer", "seller", "delivery", "admin"],
      default: "buyer",
    },

    isEmailVerified: { type: Boolean, default: false },
    emailVerificationOTP: String,
    emailVerificationOTPExpires: Date,

    passwordResetOTP: String,
    passwordResetOTPExpires: Date,

    phone: { type: String, default: "" },
    address: { type: addressSchema, default: () => ({}) },

    wishlist: { type: [mongoose.Schema.Types.ObjectId], default: [] },

    notifications: { type: [notificationSchema], default: [] },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      inApp: { type: Boolean, default: true },
      orderUpdates: { type: Boolean, default: true },
      reviews: { type: Boolean, default: true },
      promotions: { type: Boolean, default: true },
      system: { type: Boolean, default: true },
    },

    sellerSocial: { type: sellerSocialSchema, default: () => ({}) },
    cart: { type: [cartItemSchema], default: [] },
    purchaseHistory: { type: [purchaseHistorySchema], default: [] },

    isVerifiedSeller: { type: Boolean, default: false },
    lastAssignedAt: { type: Date, default: null },
    isBlocked: { type: Boolean, default: false },
    blockedAt: { type: Date, default: null },
    blockedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    blockedReason: { type: String, default: "" },
  },
  { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;

