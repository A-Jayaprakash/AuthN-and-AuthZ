require('dotenv').config();
const validateEnv = require('./config/validateEnv');
validateEnv();
const morgan = require('morgan');
const express = require('express');
const authRoutes = require('./routes/authRoutes');
const cartRoutes = require('./routes/cartRoutes');
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const categoryRoutes = require('./routes/categoryRoutes')
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');
const helmet = require('helmet');
const cors = require('cors');

const corsOptions = {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
};

const app = express();
app.use(express.json());
app.use(morgan('dev'));
app.use(cors(corsOptions));
app.use(helmet());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);

app.use(errorHandler);


const PORT = process.env.PORT || 5000;
connectDB().then(()=> {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});