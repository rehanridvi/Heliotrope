import Product from '../models/Product.js';

const toBool = (v) => String(v).toLowerCase() === 'true';
const toNum = (v) => (v === undefined || v === null || v === '' ? undefined : Number(v));

export const searchProducts = async (req, res) => {
  try {
    const {
      q = '',
      category,
      district,
      minPrice,
      maxPrice,
      minRating,
      verifiedOnly,
      inStockOnly,
      sort = 'relevance',
      page = '1',
      limit = '12',
    } = req.query;

    const Q = String(q).trim();
    const pageNum = Math.max(1, parseInt(String(page), 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(String(limit), 10) || 12));
    const skip = (pageNum - 1) * limitNum;

    const minP = toNum(minPrice);
    const maxP = toNum(maxPrice);
    const minR = toNum(minRating);

    const match = { $or: [{ isActive: true }, { isActive: { $exists: false } }] };

    if (Q) {
      const words = Q.split(/\s+/).filter(Boolean);
      if (words.length > 0) {
        const wordConditions = words.map((word) => {
          const safe = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          return {
            $or: [
              { name: { $regex: safe, $options: 'i' } },
              { description: { $regex: safe, $options: 'i' } },
              { tags: { $regex: safe, $options: 'i' } },
            ],
          };
        });
        match.$and = match.$and ? [...match.$and, ...wordConditions] : wordConditions;
      }
    }

    if (category && category !== 'All') match.category = String(category);
    if (minP !== undefined || maxP !== undefined) {
      match.price = {};
      if (minP !== undefined) match.price.$gte = minP;
      if (maxP !== undefined) match.price.$lte = maxP;
    }
    if (minR !== undefined) match.ratingAverage = { $gte: minR };
    if (toBool(inStockOnly)) match.stock = { $gt: 0 };

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'users',
          localField: 'seller',
          foreignField: '_id',
          as: 'sellerDoc',
        },
      },
      { $unwind: { path: '$sellerDoc', preserveNullAndEmptyArrays: true } },
      {
        $match: {
          'sellerDoc.role': 'seller',
          ...(district && district !== 'All' ? { 'sellerDoc.address.district': String(district) } : {}),
          ...(toBool(verifiedOnly) ? { 'sellerDoc.isVerifiedSeller': true } : {}),
        },
      },
      {
        $project: {
          name: 1, description: 1, category: 1, tags: 1, price: 1, stock: 1,
          images: 1, ratingAverage: 1, ratingCount: 1, createdAt: 1,
          seller: { _id: '$sellerDoc._id', name: '$sellerDoc.name', district: '$sellerDoc.address.district', isVerifiedSeller: '$sellerDoc.isVerifiedSeller' },
        },
      },
    ];

    let sortStage = { ratingAverage: -1, ratingCount: -1, createdAt: -1 };
    if (sort === 'newest') sortStage = { createdAt: -1 };
    else if (sort === 'priceAsc') sortStage = { price: 1 };
    else if (sort === 'priceDesc') sortStage = { price: -1 };
    else if (sort === 'highestRated') sortStage = { ratingAverage: -1, ratingCount: -1 };
    else if (sort === 'mostPopular') sortStage = { ratingCount: -1, ratingAverage: -1 };

    pipeline.push({ $sort: sortStage });
    pipeline.push({ $facet: { items: [{ $skip: skip }, { $limit: limitNum }], total: [{ $count: 'count' }] } });

    const agg = await Product.aggregate(pipeline);
    const items = agg?.[0]?.items || [];
    const total = agg?.[0]?.total?.[0]?.count || 0;

    res.json({
      products: { items, total, page: pageNum, limit: limitNum, pages: Math.ceil(total / limitNum) },
      sellers: { items: [], total: 0 },
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ message: 'Search failed', error: error.message });
  }
};
