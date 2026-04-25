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

const SellerStorefront = mongoose.model("SellerStorefront", sellerStorefrontSchema);
export const SellerStorefrontModel = SellerStorefront;
export default SellerStorefront;

