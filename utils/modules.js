// Define modules as an array constant

exports.getOperation = (method) => {
  switch (method) {
    case "GET":
      return "read";
    case "POST":
      return "write";
    case "PUT":
      return "update";
    case "DELETE":
      return "delete";
    default:
      return "unsupported";
  }
};

// Export the array constant for use in other parts of your application
// exports.AVAILABLE_MODULES = AVAILABLE_MODULES;
exports.OPERATION = {
  READ: "read",
  UPDATE: "update",
  CREATE: "write",
  DELETE: "delete",
};
// Export the isModuleAvailable function
exports.isModuleAvailable = (moduleName) => {
  return AVAILABLE_MODULES.includes(moduleName);
};
