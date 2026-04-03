// server/middleware/adminMiddleware.js
export const isAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'অ্যাডমিন অ্যাক্সেস প্রয়োজন' });
  }
  next();
};
