const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const User = require("../models/auth/User"); // Replace with the path to your user model
const bcrypt = require("bcryptjs");
require("dotenv").config();
const { sendSMS } = require("./sms");
// Function to seed users
const seedUsers = async () => {
  try {
    sendSMS("sam", "samsaf674@gmail.com", "hello", "hello", []);
  } catch (err) {
    console.error(`Seeder error: ${err.message}`);
  }
};

// Seed users
seedUsers();
