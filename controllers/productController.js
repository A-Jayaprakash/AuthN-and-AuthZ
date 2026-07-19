const Product = require('../models/Product');
const AppError = require('../utils/AppError');
const Category = require('../models/Category');

const getAllProducts = async(req, res) => {
    const query = req.query;
    const category = query.category;
    const minPrice = query.minPrice;
    const maxPrice = query.maxPrice;
    const search = query.search;
    const page = query.page;
    const pageNum = parseInt(page, 10) || 1;
    const limit = query.limit;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum-1)*limitNum;
    
    const filter = {isActive: true};
    if(minPrice || maxPrice){
        filter.price = {};
        if(minPrice) filter.price.$gte = Number(minPrice);
        if(maxPrice) filter.price.$lte = Number(maxPrice);
    }

    if(search){
        filter.name = {$regex: search, $options: 'i'};
    }

    const activeCategoryIds = await Category.find({isActive: true}).select('_id');
    filter.category = { $in: activeCategoryIds.map(c => c._id) };
    
    if(category){
        const categoryDoc = await Category.findById(category)
        if(!categoryDoc) throw new AppError('Category not found', 404);
        if(categoryDoc.isActive === false) throw new AppError('Category not found', 404);
        filter.category = category;
    }
    
    const products = await Product.find(filter).skip(skip).limit(limitNum);
    const totCount = await Product.countDocuments(filter);
    
    res.status(200).json({success: true, products, totCount});
}

const getProduct = async(req, res) => {
    const id = req.params.id;
    const product = await Product.findById(id);
    
    if(!product) throw new AppError('Product not found', 404);
    if(product.isActive === false) throw new AppError('Product not found', 404);

    res.status(200).json({success: true, product});
}

const createProduct = async(req, res) => {
    const {name, description, price, stock, category, images} = req.body;
    const exists = await Product.findOne({name});
    if(exists) throw new AppError('Product already exists', 400);

    const categoryDoc = await Category.findById(category);
    if(!categoryDoc) throw new AppError('Category not found', 404);
    if(categoryDoc.isActive === false) throw new AppError('Category not found', 404);
    
    const product = await Product.create({
        name,
        description,
        price,
        stock,
        category,
        images,
        createdBy: req.user.id
    });

    res.status(201).json({success: true, product});
}

const updateProduct = async(req, res) => {
    const id = req.params.id;
    const {name, description, price, stock, category, images} = req.body;
    const product = await Product.findById(id);
    if(!product) throw new AppError('Product not found', 404);

    const categoryDoc = await Category.findById(category);
    
    if(!categoryDoc) throw new AppError('Category not found', 404);
    if(categoryDoc.isActive === false) throw new AppError('Category not found', 404);

    const updatedProduct = await Product.findByIdAndUpdate(id, {name, description, price, stock, category, images}, {new: true, runValidators: true});
    res.status(200).json({success: true, updatedProduct});

}

const deleteProduct = async(req, res) => {
    const id = req.params.id;
    const product = await Product.findById(id);
    
    if(!product) throw new AppError('Product doesn\'t exists', 404);
    if(product.isActive === false) throw new AppError('Product doesn\'t exists', 404);

    const deletedProduct = await Product.findByIdAndUpdate(id, {isActive: false}, {new: true, runValidators: true});

    res.status(200).json({success: true, deletedProduct});
}

module.exports = {getAllProducts, getProduct, createProduct, updateProduct, deleteProduct};