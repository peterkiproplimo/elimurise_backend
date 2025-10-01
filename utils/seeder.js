const mongoose = require("mongoose");
const { faker } = require("@faker-js/faker");
const CmsUser = require("../models/cms/auth/cms_user"); // Replace with the path to your user model
require("dotenv").config();
// Function to seed users
const seedUsers = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URL);

    console.log("Connected to MongoDB");

    // Generate fake users
    const numberOfUsers = 10; // Number of users to generate
    const cms_users = Array.from({ length: numberOfUsers }, () => ({
      firstname: faker.person.firstName(),
      lastname: faker.person.lastName(),
      phone: faker.phone.number(),
      email: faker.internet.email(),
      avatar: faker.image.avatar(),
      role_id: "12233", // You might want to generate a valid role ID here
      status: 0, // Modify to generate appropriate status
      password: "samsaf",
    }));

    console.log(cms_users);
    // Insert fake users into the database
    await CmsUser.insertMany(cms_users);
    console.log("Database seeded with users.");

    // Close the connection after seeding
    mongoose.connection.close();
    console.log("Connection closed.");
  } catch (err) {
    console.error(`Seeder error: ${err.message}`);
  }
};

// Seed users
seedUsers();
