import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { Business } from '../models/Business';
import { generateSlug } from '../utils/slug';
import { auth, AuthRequest } from '../middleware/auth';
import { getMe } from '../controllers/authController';

export const authRouter = Router();

// POST /api/auth/register
authRouter.post('/register', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    // Create User
    const user = await User.create({
      email,
      passwordHash,
      role: 'owner',
    });

    // Create User business
    const business = await Business.create({
      ownerId: user._id,
      name: email.split('@')[0] + "'s business", 
      slug: generateSlug(email.split('@')[0] + '-' + user._id.toString()),
    });

    // לעדכן את ה-user עם ה-businessId
    user.businessId = business._id;
    await user.save();


    const token = jwt.sign(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
        businessId: user.businessId, 
      },
        process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.cookie('sb_token', token, {
      httpOnly: true,
      secure: false,        // ב-https production לשים true
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // שבוע
    });


    return res.status(201).json({
      token,
      business,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user.businessId,
      },
    });
  } catch (err) {
    console.error('Error in /register:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { 
        userId: user._id,
        role: user.role,
        email: user.email,
        businessId: user.businessId
      },
      process.env.JWT_SECRET || 'dev-secret',
      { expiresIn: '7d' }
    );

    res.cookie('sb_token', token, {
      httpOnly: true,
      secure: false,        // ב-https production לשים true
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000, // שבוע
    });

    return res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        businessId: user?.businessId
      },
    });
  } catch (err) {
    console.error('Error in /login:', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/auth/me
authRouter.get('/me', auth, getMe);

// logout
authRouter.post('/logout', (req, res) => {
  res.clearCookie('sb_token');
  return res.json({ success: true });
});



