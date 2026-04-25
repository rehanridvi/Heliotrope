import mongoose from "mongoose";

const bidSchema = new mongoose.Schema(
  {
    bidderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    bidderName: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    placedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const productSnapshotSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    images: { type: [String], default: [] },
    description: { type: String, default: "" },
  },
  { _id: false }
);

const auctionSchema = new mongoose.Schema(
  {
    liveSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "LiveSession", required: true, index: true },
    sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    productSnapshot: { type: productSnapshotSchema, required: true },
    basePrice: { type: Number, required: true, min: 1 },
    currentBid: { type: Number, required: true, min: 1 },
    currentWinnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    durationSeconds: { type: Number, required: true, min: 1 },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["pending", "active", "ended", "cancelled"],
      default: "pending",
      index: true,
    },
    bids: { type: [bidSchema], default: [] },
    winnerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    winnerConfirmed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

auctionSchema.index({ liveSessionId: 1, status: 1, endTime: 1 });

const Auction = mongoose.model("Auction", auctionSchema);
export default Auction;
