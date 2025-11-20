import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

export const login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [
        { email: identifier },
        { phone: identifier }
      ],
      isActive: true
    });
    if (!user) return res.status(401).json({ ok: false, message: 'User not found' });
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(401).json({ ok: false, message: 'Invalid credentials' });
    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ 
      ok: true, 
      token, 
      user: { 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        phone: user.phone, 
        role: user.role,
        permissions: user.permissions 
      } 
    });
  } catch (err) {
    next(err);
  }
};

export const me = async (req, res, next) => {
  try {
    res.json({ ok: true, user: req.user });
  } catch (err) {
    next(err);
  }
};
