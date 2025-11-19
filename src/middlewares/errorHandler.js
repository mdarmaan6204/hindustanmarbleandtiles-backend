export const errorHandler = (err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ ok: false, message: err.message || 'Server Error' });
};
