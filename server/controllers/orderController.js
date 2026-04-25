import Product from '../models/Product.js';
import Order from '../models/Order.js';
import User from '../models/User.js';
import { notifyMany, notifyUser } from '../utils/notify.js';
import { emailTemplates } from '../utils/email.js';

const pickNextDeliveryman = async () => {
  const deliverymen = await User.find({ role: 'delivery' }).sort({ lastAssignedAt: 1 });
  if (!deliverymen.length) return null;
  return deliverymen[0];
};

const shortId = (id) => `#${String(id).slice(-6).toUpperCase()}`;

export const checkout = async (req, res) => {
  try {
    const { items, phone, shippingAddress, instructions } = req.body;

    if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'Cart items required' });
    if (!phone) return res.status(400).json({ message: 'Phone is required' });
    if (!shippingAddress?.line1) return res.status(400).json({ message: 'Address line1 is required' });

    const productIds = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: productIds } }).populate('seller', '_id name email');

    const productMap = new Map(products.map((p) => [String(p._id), p]));
    const grouped = new Map();

    for (const it of items) {
      const p = productMap.get(String(it.productId));
      if (!p) continue;
      const qty = Math.max(1, Number(it.quantity || 1));
      const sellerId = String(p.seller._id);
      const orderItem = { product: p._id, seller: p.seller._id, name: p.name, price: p.price, quantity: qty };
      if (!grouped.has(sellerId)) grouped.set(sellerId, []);
      grouped.get(sellerId).push(orderItem);
    }

    if (grouped.size === 0) return res.status(400).json({ message: 'No valid products in order' });

    const created = [];
    const buyer = await User.findById(req.user._id).select('name email');

    for (const [sellerId, orderItems] of grouped.entries()) {
      const totalAmount = orderItems.reduce((sum, x) => sum + x.price * x.quantity, 0);

      const order = await Order.create({
        buyer: req.user._id,
        seller: sellerId,
        items: orderItems,
        phone,
        shippingAddress,
        instructions: instructions || '',
        totalAmount,
        status: 'pending',
      });

      created.push(order);
      const seller = await User.findById(sellerId).select('name email');

      await notifyUser({
        userId: sellerId,
        type: 'order',
        title: 'New order received',
        body: `${shortId(order._id)} • Total ৳${totalAmount}`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
        emailSubject: `New order received ${shortId(order._id)}`,
        emailHtml: emailTemplates.orderPlacedSeller({
          sellerName: seller?.name,
          buyerName: buyer?.name,
          orderId: shortId(order._id),
          totalAmount,
        }),
      });

      await notifyUser({
        userId: req.user._id,
        type: 'order',
        title: 'Order placed',
        body: `${shortId(order._id)} placed successfully. Waiting for seller confirmation.`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
      });
    }

    res.status(201).json({ orders: created });
  } catch (e) {
    console.error('checkout error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const buyerOrders = async (req, res) => {
  const orders = await Order.find({ buyer: req.user._id })
    .populate('seller', 'name')
    .populate('deliveryman', 'name')
    .populate('items.product', 'name price')
    .sort({ createdAt: -1 });
  res.json({ orders });
};

export const sellerOrders = async (req, res) => {
  const orders = await Order.find({ seller: req.user._id })
    .populate('buyer', 'name email phone')
    .populate('deliveryman', 'name')
    .populate('items.product', 'name price')
    .sort({ createdAt: -1 });
  res.json({ orders });
};

export const sellerDecision = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { decision } = req.body;

    if (!['accepted', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'decision must be accepted or rejected' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.seller) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your order' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: 'Order is not pending seller' });
    }

    order.status = decision;
    if (decision === 'accepted') {
      order.acceptedAt = new Date();
      const deliveryman = await pickNextDeliveryman();
      if (deliveryman) {
        order.deliveryman = deliveryman._id;
        order.assignedAt = new Date();
        deliveryman.lastAssignedAt = new Date();
        await deliveryman.save();
      }
    }
    await order.save();

    const buyer = await User.findById(order.buyer).select('name email');
    const seller = await User.findById(order.seller).select('name email');

    if (decision === 'accepted') {
      await notifyUser({
        userId: order.buyer,
        type: 'order',
        title: 'Order accepted',
        body: `${shortId(order._id)} accepted by seller.`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
        emailSubject: `Order accepted ${shortId(order._id)}`,
        emailHtml: emailTemplates.orderAcceptedBuyer({
          buyerName: buyer?.name,
          sellerName: seller?.name,
          orderId: shortId(order._id),
        }),
      });

      if (order.deliveryman) {
        const dm = await User.findById(order.deliveryman);
        await notifyUser({
          userId: dm._id,
          type: 'order',
          title: 'New delivery assigned',
          body: `You have been assigned ${shortId(order._id)}.`,
          link: '/dashboard',
          meta: { orderId: order._id, status: order.status },
          emailSubject: `New delivery assigned ${shortId(order._id)}`,
          emailHtml: emailTemplates.deliveryAssigned({ name: dm?.name, orderId: shortId(order._id) }),
        });
      }
    } else {
      await notifyUser({
        userId: order.buyer,
        type: 'order',
        title: 'Order rejected',
        body: `${shortId(order._id)} rejected by seller.`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
      });
    }

    res.json({ order });
  } catch (e) {
    console.error('sellerDecision error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const assignDelivery = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { deliverymanId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'accepted') {
      return res.status(400).json({ message: 'Order must be accepted to assign delivery' });
    }

    let deliveryman = null;
    if (deliverymanId) {
      deliveryman = await User.findOne({ _id: deliverymanId, role: 'delivery' });
      if (!deliveryman) return res.status(400).json({ message: 'Invalid deliverymanId' });
    } else {
      deliveryman = await pickNextDeliveryman();
      if (!deliveryman) return res.status(400).json({ message: 'No deliveryman available' });
    }

    order.deliveryman = deliveryman._id;
    order.assignedAt = new Date();
    order.status = 'assigned';
    await order.save();

    deliveryman.lastAssignedAt = new Date();
    await deliveryman.save();

    await notifyMany([order.buyer, order.seller], {
      type: 'order',
      title: 'Delivery assigned',
      body: `${shortId(order._id)} delivery assigned.`,
      link: '/dashboard',
      meta: { orderId: order._id, status: order.status },
    });

    res.json({ order });
  } catch (e) {
    console.error('assignDelivery error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const employeeOrders = async (req, res) => {
  const { status } = req.query;
  const query = {};
  if (status) query.status = status;
  else query.status = 'accepted';

  const orders = await Order.find(query)
    .populate('buyer', 'name email phone address')
    .populate('seller', 'name email phone address')
    .populate('deliveryman', 'name email phone')
    .populate('items.product', 'name price')
    .sort({ createdAt: -1 });

  res.json({ orders });
};

export const deliveryOrders = async (req, res) => {
  const orders = await Order.find({
    deliveryman: req.user._id,
    status: { $in: ['assigned', 'in-transit'] },
  })
    .populate('buyer', 'name email phone')
    .populate('seller', 'name')
    .populate('items.product', 'name price')
    .sort({ createdAt: -1 });
  res.json({ orders });
};

export const deliveryStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    if (!['in-transit', 'delivered', 'not-received'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.deliveryman) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your assigned order' });
    }

    order.status = status;
    if (status === 'delivered') order.deliveredAt = new Date();
    await order.save();

    if (status === 'in-transit') {
      await notifyMany([order.buyer, order.seller], {
        type: 'order',
        title: 'Order in transit',
        body: `${shortId(order._id)} is now in transit.`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
      });
    }

    if (status === 'delivered') {
      await notifyUser({
        userId: order.buyer,
        type: 'review',
        title: 'Delivered — please rate',
        body: `${shortId(order._id)} delivered. Please leave a review.`,
        link: `/orders/${order._id}/review`,
        meta: { orderId: order._id, status: order.status },
        emailSubject: `Delivered ${shortId(order._id)} — please rate`,
        emailHtml: emailTemplates.orderDeliveredReview({ name: (await User.findById(order.buyer))?.name, orderId: shortId(order._id) }),
      });
      await notifyUser({
        userId: order.seller,
        type: 'order',
        title: 'Order delivered',
        body: `${shortId(order._id)} delivered to buyer.`,
        link: '/dashboard',
        meta: { orderId: order._id, status: order.status },
      });
    }

    res.json({ order });
  } catch (e) {
    console.error('deliveryStatus error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};

export const buyerCancelOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { reason } = req.body;

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (String(order.buyer) !== String(req.user._id)) {
      return res.status(403).json({ message: 'Not your order' });
    }
    if (order.status !== 'pending') {
      return res.status(400).json({ message: `Cannot cancel. Current status is ${order.status}.` });
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = reason ? String(reason) : '';
    await order.save();

    await notifyUser({
      userId: order.seller,
      type: 'order',
      title: 'Order cancelled by buyer',
      body: `${shortId(order._id)} was cancelled.`,
      link: '/dashboard',
      meta: { orderId: order._id, status: order.status },
    });

    res.json({ order });
  } catch (e) {
    console.error('buyerCancelOrder error:', e);
    res.status(500).json({ message: 'Server error' });
  }
};
