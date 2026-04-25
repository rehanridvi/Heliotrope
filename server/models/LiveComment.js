import mongoose from "mongoose";

const liveCommentSchema = new mongoose.Schema(
  {
    channelName: { type: String, required: true, index: true, trim: true },
    username: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true },
    avatar: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

liveCommentSchema.index({ channelName: 1, timestamp: -1 });

const LiveComment = mongoose.model("LiveComment", liveCommentSchema);
export const LiveCommentModel = LiveComment;
export default LiveComment;

