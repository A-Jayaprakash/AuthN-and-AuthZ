const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const admin = require('../middleware/admin');
const {getOrder, getAllOrders, getMyOrders, createOrder, updateOrder, updateOrderAddress, deleteOrder} = require('../controllers/orderController');

//GET requests
router.get('/my-orders/:id', auth, getOrder);
router.get('/my-orders', auth, getMyOrders);
router.get('/', auth, admin, getAllOrders);

//POST requests
router.post('/', auth, createOrder);

//PUT requests
router.put('/:id/status', auth, admin, updateOrder);
router.put('/:id/address', auth, updateOrderAddress);
//DELETE requests
router.delete('/:id', auth, deleteOrder);

module.exports = router;