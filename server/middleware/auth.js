export const authenticate = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Missing x-user-id header'
      }
    });
  }
  req.userId = userId;
  next();
};
