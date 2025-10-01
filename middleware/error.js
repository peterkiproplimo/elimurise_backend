exports.bodyError = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 404 && 'body' in err) {
    // Handle JSON syntax errors
    return res.status(404).json({error: 'Bad request. Invalid JSON.'});
  }
  // Pass the error to the next error middleware

  next();
};
