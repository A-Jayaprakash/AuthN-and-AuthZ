const User = require('../models/User');
const AppError = require('../utils/AppError');

const getAllUsers = async(req, res) => {
    const users = await User.find().select('-password');
    if(users.length === 0) throw new AppError('No users found', 404);
    res.status(200).json({success: true, users});
}

const getUser = async(req, res)=> {
    const id = req.params.id;
    const user = await User.findById(id);
    
    if(!user) throw new AppError('User not found', 404);
    
    if(req.user.id !== user._id.toString() && req.user.role !== 'admin'){
        throw new AppError('Not authorized to view this profile', 403);
    }

    return res.status(200).json({success: true, user});

}

const updateUser = async(req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);

    const {name, address} = req.body;

    if(!user) 
        throw new AppError('User profile not found', 404);

    if(req.user.id !== user._id.toString() && req.user.role !== 'admin') 
        throw new AppError('Not authorized to update this profile', 403);
    
    const updatedUser = await User.findByIdAndUpdate(id, {name, address}, {new: true, runValidators: true});
    // We are not allowing email change as it is a separate endpoint just as password change

    res.status(200).json({success: true, user: updatedUser});
}

const deleteUser = async(req, res) => {
    const id = req.params.id;
    const user = await User.findById(id);

    if(!user) throw new AppError('User profile not found', 404);

    if(req.user.id !== user._id.toString() && req.user.role !== 'admin') throw new AppError('Not authorized to delete this profile', 403);

    const deactivateUser = await User.findByIdAndUpdate(id, {isActive: false}, {new: true, runValidators: true});

    res.status(200).json({success: true, message: 'User profile deleted successfully'});
}

module.exports = {getAllUsers, getUser, updateUser, deleteUser};