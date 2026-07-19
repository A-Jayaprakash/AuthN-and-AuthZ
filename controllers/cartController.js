const Cart = require('../models/Cart');
const Product = require('../models/Product');
const AppError = require('../utils/AppError');

const getAllItems = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id }).populate('items.product');

  if (!cart) {
    return res.status(200).json({ success: true, cart: { items: [] } });
  }

  res.status(200).json({ success: true, cart });
};

const addItem = async (req, res) => {
  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);
  if (product.isActive === false) throw new AppError('Product not found', 404);
  if (product.stock < quantity) throw new AppError('Out of stock', 400);

  let cart = await Cart.findOne({ user: req.user.id });

  if (!cart) {
    cart = await Cart.create({
      user: req.user.id,
      items: [{ product: productId, quantity }]
    });
    return res.status(201).json({ success: true, cart });
  }

  const existingItem = cart.items.find(
    item => item.product.toString() === productId
  );

  if (existingItem) {
    existingItem.quantity += quantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();

  res.status(200).json({ success: true, cart });
};

const updateItem = async (req, res) => {
  const { productId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) throw new AppError('Product not found', 404);
  if(product.isActive === false) throw new AppError('Product not found', 404);
  if (product.stock < quantity) throw new AppError('Out of stock', 400);

  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) throw new AppError('Cart not found', 404);

  const item = cart.items.find(
    item => item.product.toString() === productId
  );
  if (!item) throw new AppError('Item not found in cart', 404);

  item.quantity = quantity;
  await cart.save();

  res.status(200).json({ success: true, cart });
};

const deleteItem = async (req, res) => {
  const productId = req.params.id;

  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) throw new AppError('Cart not found', 404);

  cart.items = cart.items.filter(
    item => item.product.toString() !== productId
  );

  await cart.save();

  res.status(200).json({ success: true, cart });
};

const clearCart = async (req, res) => {
  const cart = await Cart.findOne({ user: req.user.id });
  if (!cart) {
    return res.status(200).json({ success: true, message: 'Cart already empty' });
  }

  cart.items = [];
  await cart.save();

  res.status(200).json({ success: true, cart });
};

module.exports = { getAllItems, addItem, updateItem, deleteItem, clearCart };