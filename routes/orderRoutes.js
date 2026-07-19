const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {createOrderSchema, updateOrderAddressSchema, updateOrderStatusSchema} = require('../validators/orderValidator');
const validate = require('../middleware/validate');
const {getOrder, getAllOrders, getMyOrders, createOrder, updateOrder, updateOrderAddress, deleteOrder} = require('../controllers/orderController');
const asyncHandler = require('../utils/asyncHandler');

//GET requests
router.get('/my-orders/:id', auth, asyncHandler(getOrder));
router.get('/my-orders', auth, asyncHandler(getMyOrders));
router.get('/', auth, admin, asyncHandler(getAllOrders));

//POST requests
router.post('/', auth, validate(createOrderSchema), asyncHandler(createOrder));

//PUT requests
router.put('/:id/status', auth, admin, validate(updateOrderStatusSchema), asyncHandler(updateOrder));
router.put('/:id/address', auth, validate(updateOrderAddressSchema), asyncHandler(updateOrderAddress));

//DELETE requests
router.delete('/:id', auth, asyncHandler(deleteOrder));

module.exports = router;