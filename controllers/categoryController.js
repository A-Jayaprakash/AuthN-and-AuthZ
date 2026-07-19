const Category = require('../models/Category');
const AppError = require('../utils/AppError');

const getAllCategories  = async(req, res) => {
    const categories = await Category.find({isActive: true});

    res.status(200).json({success: true, categories});
}

const getCategory = async(req, res) => {
    const id = req.params.id;
    const category = await Category.findById(id);

    if(!category) throw new AppError('Category not found', 404);

    res.status(200).json({success: true, category});
}

const createCategory = async(req, res) => {
    const {name, description} = req.body;

    const slug = name.toLowerCase().trim().replace(/\s+/g, '-');

    const exist = await Category.findOne({name});
    if(exist) throw new AppError('Category already exists', 400);

    const category = await Category.create({
        name,
        slug,
        description
    });

    res.status(201).json({success: true, category});
}

const updateCategory = async(req, res) => {
    const id = req.params.id;
    const category = await Category.findById(id);
    if(!category) throw new AppError('Category does not exist', 404);

    const {name, description} = req.body;

    const slug = name.toLowerCase().trim().replace(/\s+/g, '-');

    const updatedCategory = await Category.findByIdAndUpdate(id, {name, slug, description}, {new: true, runValidators: true});

    res.status(200).json({success: true, category: updatedCategory});
}

const deleteCategory = async(req, res) => {
    const id = req.params.id;
    const category = await Category.findById(id);

    if(!category) throw new AppError('Category not found', 404);

    const updatedCategory = await Category.findByIdAndUpdate(id, {isActive: false}, {new: true, runValidators: true});

    res.status(200).json({success: true, category: updatedCategory});
}

module.exports = {getAllCategories, getCategory, createCategory, updateCategory, deleteCategory};