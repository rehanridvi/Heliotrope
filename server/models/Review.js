import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },

    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, default: '' },
    images: [{ type: String }],

    reply: {
      text: { type: String, default: '' },
      createdAt: { type: Date },
    },

    isVisible: { type: Boolean, default: true },
  },
  { timestamps: true }
);

reviewSchema.index({ product: 1, createdAt: -1 });
reviewSchema.index({ seller: 1, createdAt: -1 });

const Review = mongoose.model('Review', reviewSchema);
export default Review;

