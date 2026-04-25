import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reportedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    type: {
      type: String,
      enum: ['seller', 'product', 'review', 'other'],
      required: true,
    },

    reason: { type: String, required: true },
    details: { type: String, default: '' },

    status: {
      type: String,
      enum: ['pending', 'resolved', 'dismissed'],
      default: 'pending',
    },

    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolution: { type: String, default: '' },
  },
  { timestamps: true }
);

const Report = mongoose.model('Report', reportSchema);
export default Report;

