import mongoose from "mongoose";

const storefrontProductSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true, index: true },
    storefrontId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SellerStorefront",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: "" },
    price: { type: Number, required: true, min: 0 },
    imageUrl: { type: String },
  },
  { timestamps: true }
);

export const StorefrontProductModel =
  mongoose.models.StorefrontProduct ||
  mongoose.model("StorefrontProduct", storefrontProductSchema);
