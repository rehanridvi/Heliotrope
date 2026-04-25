import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    name: { type: String, required: true },
    description: { type: String, default: '' },

    category: {
      type: String,
      default: 'Other',
      enum: ['Fashion', 'Jewelry', 'Handmade', 'Home', 'Beauty', 'Art', 'Food', 'Other'],
    },

    tags: { type: [String], default: [] },

    price: { type: Number, required: true, min: 0 },
    stock: { type: Number, default: 1 },

    images: [{ type: String }],

    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    ratingAverage: { type: Number, default: 0 },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Text index for keyword search
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Helpful indexes for filtering
productSchema.index({ category: 1, price: 1, ratingAverage: -1, createdAt: -1, stock: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;

