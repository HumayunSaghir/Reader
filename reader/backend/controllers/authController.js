const { sendError } = require('../middlewares/errorHandler');
const User = require('../models/User');
const Shelf = require('../models/Shelf');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { jwtSecret, jwtExpiresIn, googleClientId } = require('../config/env');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_CUSTOM_SHELVES = 30;

const generateToken = (id) => jwt.sign({ id }, jwtSecret, { expiresIn: jwtExpiresIn });

const toAuthResponse = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatar: user.avatar,
  customShelves: user.customShelves,
  token: generateToken(user._id)
});

const registerUser = async (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';

  if (!name || name.length > 60) return res.status(400).json({ message: 'Please enter your name (up to 60 characters)' });
  if (!EMAIL_PATTERN.test(email) || email.length > 254) return res.status(400).json({ message: 'Please enter a valid email address' });
  if (password.length < 8 || password.length > 128) return res.status(400).json({ message: 'Password must be at least 8 characters' });

  try {
    const userExists = await User.exists({ email });
    if (userExists) return res.status(400).json({ message: 'An account with this email already exists' });

    const user = await User.create({ name, email, password });
    res.status(201).json(toAuthResponse(user));
  } catch (error) {
    sendError(res, error);
  }
};

const loginUser = async (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    // Accounts created before emails were normalised may have mixed case
    const user = await User.findOne({ email }) ||
      await User.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
    if (user && (await user.matchPassword(password))) {
      res.json(toAuthResponse(user));
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    sendError(res, error);
  }
};

let googleClient;

// Public: tells the apps whether to show "Continue with Google" and which client to use
const getGoogleConfig = (req, res) => {
  res.json({ enabled: Boolean(googleClientId), clientId: googleClientId || null });
};

// Sign in (or sign up) with a Google ID token from the app's Google sign-in flow
const googleLogin = async (req, res) => {
  if (!googleClientId) return res.status(503).json({ message: 'Google sign-in is not available' });
  const idToken = typeof req.body.idToken === 'string' ? req.body.idToken : '';
  if (!idToken) return res.status(400).json({ message: 'Missing Google credential' });

  let payload;
  try {
    googleClient ||= new OAuth2Client();
    const ticket = await googleClient.verifyIdToken({ idToken, audience: googleClientId });
    payload = ticket.getPayload();
  } catch {
    return res.status(401).json({ message: 'Google sign-in failed. Please try again.' });
  }
  if (!payload?.sub || !payload.email || !payload.email_verified) {
    return res.status(401).json({ message: 'Your Google account has no verified email address' });
  }

  try {
    const email = payload.email.toLowerCase();
    let user = await User.findOne({ googleId: payload.sub });
    if (!user) {
      // Link to an existing email/password account; Google has verified the address
      user = await User.findOne({ email }) ||
        await User.findOne({ email: { $regex: `^${email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } });
      if (user) {
        user.googleId = payload.sub;
        if (!user.avatar && payload.picture) user.avatar = payload.picture;
        await user.save();
      } else {
        user = await User.create({
          name: (payload.name || email.split('@')[0]).slice(0, 60),
          email,
          googleId: payload.sub,
          avatar: payload.picture || '',
        });
      }
    }
    res.json(toAuthResponse(user));
  } catch (error) {
    sendError(res, error);
  }
};

const getUserProfile = async (req, res) => {
  const { _id, name, email, avatar, customShelves } = req.user;
  res.json({ _id, name, email, avatar, customShelves });
};

const uploadPhoto = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const user = await User.findById(req.user._id);
    user.avatar = `/uploads/${req.file.filename}`;
    const updatedUser = await user.save();
    res.json(toAuthResponse(updatedUser));
  } catch (error) {
    sendError(res, error);
  }
};

const addCustomShelf = async (req, res) => {
  const shelfName = typeof req.body.shelfName === 'string' ? req.body.shelfName.trim() : '';
  if (!shelfName || shelfName.length > 50) {
    return res.status(400).json({ message: 'Shelf names must be 1-50 characters' });
  }

  try {
    const user = await User.findById(req.user._id);
    if (!user.customShelves.includes(shelfName)) {
      if (user.customShelves.length >= MAX_CUSTOM_SHELVES) {
        return res.status(400).json({ message: `You can have up to ${MAX_CUSTOM_SHELVES} custom shelves` });
      }
      user.customShelves.push(shelfName);
      await user.save();
    }
    res.json(user.customShelves);
  } catch (error) {
    sendError(res, error);
  }
};

const removeCustomShelf = async (req, res) => {
  try {
    const { shelfName } = req.params;
    const user = await User.findById(req.user._id);
    user.customShelves = user.customShelves.filter(s => s !== shelfName);
    await user.save();

    await Shelf.updateMany({ user: user._id }, { $pull: { customShelves: shelfName } });
    // Drop shelf entries that no longer hold the book anywhere
    await Shelf.deleteMany({ user: user._id, status: null, customShelves: { $size: 0 } });

    res.json(user.customShelves);
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = { registerUser, loginUser, getGoogleConfig, googleLogin, getUserProfile, uploadPhoto, addCustomShelf, removeCustomShelf };
