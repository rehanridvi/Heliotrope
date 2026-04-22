import mongoose from "mongoose";

const liveCommentSchema = new mongoose.Schema(
  {
    channelName: { type: String, required: true, index: true, trim: true },
    username: { type: String, required: true, trim: true, maxlength: 60 },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    avatar: { type: String, default: null, trim: true, maxlength: 400 },
  },
  { timestamps: true }
);

liveCommentSchema.index({ channelName: 1, timestamp: -1, _id: -1 });

export const LiveCommentModel =
  mongoose.models.LiveComment || mongoose.model("LiveComment", liveCommentSchema);

