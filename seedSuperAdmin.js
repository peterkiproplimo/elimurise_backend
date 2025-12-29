require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/cms/auth/User');

const seedSuperAdmin = async () => {
  try {
    // Connect to MongoDB
    const URL1 = "mongodb+srv://Safaribust:8R4NGbiciCMxCQX1@cluster0.yuiecha.mongodb.net/frontoffice?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(URL1);
    console.log("Connected to MongoDB");
 
    // Superadmin user data
    const superAdminData = {
      firstname: "Super",
      lastname: "Admin",
      email: "superadmin@elimurise.com",
      phone: "+254700000000",
      password: "SuperAdmin@2024", // Change this to your desired password
      status: 1, // Active status
      verified: true,
      super_admin: true,
    };

    // Check if superadmin already exists
    const existingUser = await User.findOne({ email: superAdminData.email });
    
    if (existingUser) {
      console.log("Superadmin user already exists with email:", superAdminData.email);
      console.log("Updating existing user to superadmin...");
      
      // Hash password
      const hashedPassword = await bcrypt.hash(superAdminData.password, 12);
      
      // Update existing user to superadmin
      existingUser.password = hashedPassword;
      existingUser.super_admin = true;
      existingUser.status = 1;
      existingUser.verified = true;
      await existingUser.save();
      
      console.log("Superadmin user updated successfully!");
      console.log("Email:", superAdminData.email);
      console.log("Password:", superAdminData.password);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(superAdminData.password, 12);
      
      // Create new superadmin user
      const superAdmin = await User.create({
        ...superAdminData,
        password: hashedPassword,
      });
      
      console.log("Superadmin user created successfully!");
      console.log("Email:", superAdminData.email);
      console.log("Password:", superAdminData.password);
      console.log("User ID:", superAdmin._id);
    }

    // Close the connection
    await mongoose.connection.close();
    console.log("Connection closed.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding superadmin:", error.message);
    if (error.code === 11000) {
      console.error("Duplicate key error - user with this email already exists");
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seeder
seedSuperAdmin();

