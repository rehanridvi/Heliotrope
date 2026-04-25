import mongoose from "mongoose";

const pinnedProductSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    image: { type: String, trim: true },
    link: { type: String, trim: true },
  },
  { _id: false }
);

const liveSessionSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true, index: true, trim: true },
    sellerName: { type: String, required: true, trim: true },
    channelName: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true, trim: true },
    isActive: { type: Boolean, default: true, index: true },
    viewerCount: { type: Number, default: 0, min: 0 },
    pinnedProduct: { type: pinnedProductSchema, default: null },
    startedAt: { type: Date, default: Date.now, index: true },
    endedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

const LiveSession = mongoose.model("LiveSession", liveSessionSchema);
export const LiveSessionModel = LiveSession;
export default LiveSession;

