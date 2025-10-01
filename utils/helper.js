exports.validateDate = async dateString => {
  const date = new Date(dateString);
  return !isNaN(date.getTime()); // Checking if the date is valid
};
exports.Invoices = {
  Deposit: 'deposit',
  Rent: 'rent',
  penalty: 'penalty',
};
exports.formatCurrency = amount => {
  return Number(amount).toLocaleString(undefined, {
    minimumFractionDigits: 0,
  });
};
exports.capitalizeFirstLetter = string => {
  return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
};
exports.rank = score => {
  switch (score) {
    case 4:
      return 'Exceeding Expectation';
    case 3:
      return 'Meeting Expectation';
    case 2:
      return 'Approaching Expectation';
    case 1:
      return 'Below Expectation';
    case 0:
      return 'Not Ranked';
  }
};
exports.generateNextSession = currentSession => {
  const nextSession = Number(currentSession) + 1;
  return nextSession;
};
exports.ROLE = {
  SUPER_ADMIN: 'Super Admin',
};
