const User = require('../models/User');
const jwt = require('jsonwebtoken');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

const registerUser = async (req, res) => {
  const { name, email, password } = req.body;
  
  try {
    const userExists = await User.findOne({ email });
    if (userExists) return res.status(400).json({ message: 'User already exists' });

    const user = await User.create({ name, email, password });
    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        customShelves: user.customShelves,
        token: generateToken(user._id)
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const loginUser = async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const user = await User.findOne({ email });
    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        customShelves: user.customShelves,
        token: generateToken(user._id)
      });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getUserProfile = async (req, res) => {
  const user = await User.findById(req.user._id);
  if (user) {
    res.json({ _id: user._id, name: user.name, email: user.email, avatar: user.avatar, customShelves: user.customShelves });
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

const uploadPhoto = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    if (req.file) {
      user.avatar = `/${req.file.path.replace(/\\/g, '/')}`;
      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        avatar: updatedUser.avatar,
        customShelves: updatedUser.customShelves,
        token: generateToken(updatedUser._id)
      });
    } else {
      res.status(400).json({ message: 'No file uploaded' });
    }
  } else {
    res.status(404).json({ message: 'User not found' });
  }
};

const addCustomShelf = async (req, res) => {
  const { shelfName } = req.body;
  if (!shelfName) return res.status(400).json({ message: 'Shelf name is required' });
  
  const user = await User.findById(req.user._id);
  if (!user.customShelves.includes(shelfName)) {
    user.customShelves.push(shelfName);
    await user.save();
  }
  res.json(user.customShelves);
};

const removeCustomShelf = async (req, res) => {
  const { shelfName } = req.params;
  const user = await User.findById(req.user._id);
  
  user.customShelves = user.customShelves.filter(s => s !== shelfName);
  await user.save();
  
  const Shelf = require('../models/Shelf');
  await Shelf.updateMany(
    { user: user._id },
    { $pull: { customShelves: shelfName } }
  );
  
  res.json(user.customShelves);
};

module.exports = { registerUser, loginUser, getUserProfile, uploadPhoto, addCustomShelf, removeCustomShelf };
