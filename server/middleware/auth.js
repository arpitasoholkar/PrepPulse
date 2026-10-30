import mongoose from 'mongoose';
import User from '../models/User.js';

/**
 * Authentication middleware that reads `x-user-id` from request headers,
 * loads the corresponding user document from MongoDB, attaches `req.userId` and `req.user`,
 * and returns HTTP 401 if the header is missing or the user does not exist.
 */
export const authenticate = async (req, res, next) => {
  const userId = req.headers['x-user-id'];

  if (!userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing x-user-id header'
      }
    });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid x-user-id format'
      }
    });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }

    req.user = user;
    req.userId = user._id.toString();
    next();
  } catch (error) {
    next(error);
  }
};

export default authenticate;
