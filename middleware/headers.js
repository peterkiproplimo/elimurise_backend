exports.setResponseHeaders = (req, res, next) => {
  // Set headers for all responses

  res.setHeader(
    "X-Powered-By",
    "Samson Safari 254714241029 samsaf674@gmail.com"
  );
  // res.setHeader("Developed By", "Samson Safari");

  // Set headers for specific routes or paths

  // Continue to the next middleware
  next();
};
