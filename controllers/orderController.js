const mongoose = require('mongoose');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

const getOrder = async(req, res) => {
    const id = req.params.id;
    const order = await Order.findById(id);
    if(!order) throw new AppError('Order not found', 404);
    if(req.user.id !== order.user.toString() && req.user.role !== 'admin') throw new AppError('Not authorized to view this order', 403);
    res.status(200).json({success: true, order});
}

const getMyOrders = async(req, res) => {
    const orders = await Order.find({user: req.user.id});
    res.status(200).json({success: true, orders});
}

const getAllOrders = async(req, res) => {
    const orders = await Order.find().populate('user', 'name email');
    res.status(200).json({success: true, orders});
}

const createOrder = async (req, res) => {
  const { shippingAddress } = req.body;

  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

  if (!cart || cart.items.length === 0) {
    throw new AppError('Cart is empty', 400);
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const orderItems = [];
    let totalAmount = 0;

    // Step 1: validate every item BEFORE changing anything
    for (const cartItem of cart.items) {
      const product = cartItem.product;

      if (!product || product.isActive === false) {
        throw new AppError(`Product no longer available`, 400);
      }

      if (product.stock < cartItem.quantity) {
        throw new AppError(`Insufficient stock for ${product.name}`, 400);
      }

      orderItems.push({
        product: product._id,
        quantity: cartItem.quantity,
        priceAtPurchase: product.price
      });

      totalAmount += product.price * cartItem.quantity;
    }

    // Step 2: decrement stock for every product, inside the transaction
    for (const item of orderItems) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: -item.quantity } },
        { session }
      );
    }

    // Step 3: create the order
    const order = await Order.create(
      [{
        user: req.user.id,
        items: orderItems,
        totalAmount,
        shippingAddress: shippingAddress || req.user.address,
        status: 'pending',
        paymentStatus: 'pending'
      }],
      { session }
    );

    // Step 4: clear the cart
    cart.items = [];
    await cart.save({ session });

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ success: true, order: order[0] });

  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
};

const updateOrder = async(req, res) => {
    const id = req.params.id;
    const order = await Order.findById(id);
    if(!order) throw new AppError('Order not found', 404);
    const {status} = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(id, {status}, {new: true, runValidators: true});
    res.status(200).json({success: true, order: updatedOrder});
}

const updateOrderAddress = async(req, res) => {
    const id = req.params.id;
    const order = await Order.findById(id);
    const {shippingAddress} = req.body;
    if(!order) throw new AppError('Order not found', 404);

    if(req.user.id !== order.user.toString() && req.user.role !== 'admin'){
        throw new AppError('Not authorized to view this order', 403);
    }

    if(order.status !== 'pending') throw new AppError('Cannot modify address after processing has started', 400);

    const updatedOrder = await Order.findByIdAndUpdate(id, {shippingAddress}, {new: true, runValidators: true});
    res.status(200).json({success: true, order: updatedOrder});
}

const deleteOrder = async(req, res) => {
    const id = req.params.id;
    const order = await Order.findById(id);
    if(!order) throw new AppError('Order not found', 404);
    
    if(['shipped', 'delivered'].includes(order.status)){
        throw new AppError('Cannot cancel an order that has already shipped', 400);
    }

    const deletedOrder = await Order.findByIdAndUpdate(id, {status: 'cancelled'}, {new: true, runValidators: true});
    res.status(200).json({success: true, order: deletedOrder});
}

module.exports = {getAllOrders, getOrder, getMyOrders, createOrder, updateOrder, updateOrderAddress, deleteOrder};