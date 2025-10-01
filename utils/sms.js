const axios = require("axios");
exports.sendSMS = async (name, email, subject, html, headers) => {
  console.log(name);
  try {
    // const res = await axios.get("http://www.google.com");
    // console.log(res);
  } catch (error) {
    console.log("email not sent");
    console.log(error);
  }
};
