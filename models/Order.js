const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    user:{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    
    items:{
        type: [{
            product:{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product'
            },
            quantity:{
                type: Number
            },
            priceAtPurchase: {
                type: Number
            }
        }]
    },

    totalAmount:{
        type: Number
    },

    shippingAddress:{
        street: {
            type: String
        },

        city: {
            type: String
        },

        state: {
            type: String
        },

        zip: {
            type: String
        },

        country: {
            type: String
        }
    },

    status:{
        type: String,
        enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'],
        default: 'pending'
    },

    paymentStatus:{
        type: String,
        enum: ['pending', 'paid', 'failed'],
        default: 'pending'
    },

    createdAt:{
        type: Date,
        default: Date.now,
    }
});

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;