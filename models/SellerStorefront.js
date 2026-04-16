import mongoose from "mongoose";

const sellerStorefrontSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true, unique: true, index: true },
    storeName: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, index: true },
    logoUrl: { type: String },
    bannerUrl: { type: String },
    description: { type: String, trim: true, default: "" },
    categoryTags: [{ type: String, trim: true }],
  },
  { timestamps: true }
);

export const SellerStorefrontModel =
  mongoose.models.SellerStorefront ||
  mongoose.model("SellerStorefront", sellerStorefrontSchema);
