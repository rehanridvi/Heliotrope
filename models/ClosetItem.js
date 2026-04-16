import mongoose from "mongoose";

export const CLOSET_ITEM_TYPES = [
  "clothes",
  "accessories",
  "bags",
  "glasses",
  "shoes",
  "makeup",
];

const closetItemSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      required: true,
      enum: CLOSET_ITEM_TYPES,
    },
    colors: [{ type: String, trim: true }],
    brand: { type: String, trim: true },
    occasions: [{ type: String, trim: true }],
    imageUrl: { type: String },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const ClosetItemModel = mongoose.models.ClosetItem || mongoose.model("ClosetItem", closetItemSchema);
