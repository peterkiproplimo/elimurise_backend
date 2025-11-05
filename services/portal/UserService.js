const User = require('../../models/portal/auth/User');
const bcrypt = require('bcryptjs');
const NotificationService = require('../../services/NotificationService');
const notificationService = new NotificationService();
const crypto = require('crypto');

class UserService {
  async createUser(userData) {
    try {
      const {firstname, lastname, phone, email, avater, role, password, workflow_state, teacher, school, school_admin} =
        userData;

      const user = await User.findOne({email});
      if (user) {
        throw new Error('User Already exist with the email provided');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await User.create({
        firstname,
        lastname,
        phone,
        email,
        avater,
        role,
        workflow_state,
        status: 1,
        teacher,
        school,
        school_admin,
        password: hashedPassword,
      });
      // console.log(newUser);
      // this.welcomeMessage(email, password);
      await this.welcomeMessage(email);
      return newUser;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async getSuperAdmin(school) {
    return await User.findOne({school, school_admin: true});
  }
  async createUserWithSession(userData, session) {
    try {
      const {firstname, lastname, phone, email, avater, role, password, workflow_state, teacher, school, school_admin} =
        userData;

      const user = await User.findOne({email}).session(session);
      if (user) {
        throw new Error('User Already exist with the email provided');
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const newUser = await User.create(
        [
          {
            firstname,
            lastname,
            phone,
            email,
            avater,
            role,
            workflow_state,
            status: 1,
            teacher,
            school,
            school_admin,
            password: hashedPassword,
          },
        ],
        {session},
      );
      // console.log(newUser);
      // this.welcomeMessage(email, password);
      await this.welcomeMessageSession(email, session);
      return newUser;
    } catch (error) {
      console.log(error);
      throw error;
    }
  }
  async findById(id) {
    try {
      const user = await User.findById(id);
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }

  async updateUser(id, updatedData) {
    try {
      const updatedUser = await User.findByIdAndUpdate(id, updatedData, {
        new: true,
      });
      if (!updatedUser) {
        throw new Error('User not found');
      }
      return updatedUser;
    } catch (error) {
      throw error;
    }
  }

  async deleteUser(id) {
    try {
      const deletedUser = await User.findByIdAndDelete(id);
      if (!deletedUser) {
        throw new Error('User not found');
      }
      return deletedUser;
    } catch (error) {
      throw error;
    }
  }
  async findByEmail(school, email) {
    try {
      const user = await User.findOne({school, email});
      // if (!user) {
      //   throw new Error('User not found');
      // }
      return user;
    } catch (error) {
      throw error;
    }
  }
  // async sendOTP(email) {
  //   try {
  //     // Find user by email
  //     const user = await User.findOne({email: email});

  //     if (!user) {
  //       throw new Error('Provided email is not registered in our system');
  //     }

  //     // Generate a random OTP
  //     const OTP = Math.floor(100000 + Math.random() * 900000).toString();
  //     await notificationService.sendMail(
  //       user.firstname,
  //       email,
  //       'One Time Password(OTP)',
  //       `Your one time password is,
  //       <center><h1>${OTP}</h1></center>,<br/>
  //        Please Do not share with any one.
  //        <br/>If you didn't request for password reset
  //        please ignore this mail`,
  //     );
  //     //ee
  //     // Set the OTP and its expiration time
  //     user.otp = OTP;
  //     user.otp_expires_in = Date.now() + 600000; // OTP expires in 10 minutes
  //     // Save the user with the OTP details
  //     await user.save();

  //     return 'OTP sent successfully ' + OTP;
  //   } catch (error) {
  //     throw error;
  //   }
  // }
  async welcomeMessageSession(email, session) {
    try {
      // Find user by email
      const user = await User.findOne({email: email}).session(session);
      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }
      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash the reset token to store it securely in the database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const resetLink = `${process.env.SCHOOLURL}auth/reset-password/${resetToken}`;
      // console.log(resetLink);
      // Generate a random OTP
      await notificationService.sendMail(
        user.firstname,
        email,
        'Elimurise Welcome Message',
        `
          <p>Welcome to elimurise . Click the button below to reset your password:</p>
          <a href="${resetLink}" 
            style="
              display: inline-block;
              background-color: #007bff;
              color: #ffffff;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              font-size: 16px;
              border-radius: 5px;
            ">
            Reset Password
          </a>
          <br/> <br/><br/>or click ${resetLink}
          <p>If you did not request this, please ignore this email.</p>
          <p>Thanks, `,
      );

      // Set the OTP and its expiration time
      user.otp = hashedToken;
      user.otp_expires_in = Date.now() + 6000000; // OTP expires in 10 minutes
      // Save the user with the OTP details
      await user.save({session});

      return 'Welcome message sent successfully ';
    } catch (error) {
      throw error;
    }
  }
  async sendOTP(email) {
    try {
      // Find user by email
      const user = await User.findOne({email: email});
      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }
      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash the reset token to store it securely in the database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const resetLink = `${process.env.SCHOOLURL}auth/reset-password/${resetToken}`;
      // console.log(resetLink);
      // Generate a random OTP
      await notificationService.sendMail(
        user.firstname,
        email,
        'Password Reset Link',
        `
          <p>You requested a password reset. Click the button below to reset your password:</p>
          <a href="${resetLink}" 
            style="
              display: inline-block;
              background-color: #007bff;
              color: #ffffff;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              font-size: 16px;
              border-radius: 5px;
            ">
            Reset Password
          </a>
          <br/> <br/><br/>or click ${resetLink}
          <p>If you did not request this, please ignore this email.</p>
          <p>Thanks, `,
      );
      const hashedPassword = await bcrypt.hash('Elimurise@12345', 12);
      // Reset the user's password and clear OTP data
      user.password = hashedPassword;
      // Set the OTP and its expiration time
      user.otp = hashedToken;
      user.otp_expires_in = Date.now() + 600000; // OTP expires in 10 minutes
      // Save the user with the OTP details
      await user.save();

      return 'Reset Link sent successfully ';
    } catch (error) {
      throw error;
    }
  }
  async welcomeMessage(email) {
    try {
      // Find user by email
      const user = await User.findOne({email: email});
      console.log(user);
      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }
      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash the reset token to store it securely in the database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const resetLink = `${process.env.SCHOOLURL}auth/reset-password/${resetToken}`;
      // console.log(resetLink);
      // Generate a random OTP
      await notificationService.sendMail(
        user.firstname,
        email,
        'Elimurise Welcome Message',
        `
          <p>Welcome to elimurise . Click the button below to reset your password:</p>
          <a href="${resetLink}" 
            style="
              display: inline-block;
              background-color: #007bff;
              color: #ffffff;
              padding: 10px 20px;
              text-align: center;
              text-decoration: none;
              font-size: 16px;
              border-radius: 5px;
            ">
            Reset Password
          </a>
          <br/> <br/><br/>or click ${resetLink}
          <p>If you did not request this, please ignore this email.</p>
          <p>Thanks, `,
      );

      // Set the OTP and its expiration time
      user.otp = hashedToken;
      user.otp_expires_in = Date.now() + 6000000; // OTP expires in 10 minutes
      // Save the user with the OTP details
      await user.save();

      return 'Welcome message sent successfully ';
    } catch (error) {
      throw error;
    }
  }

  async resetPassword(token, newPassword) {
    try {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
      console.log(hashedToken);
      // Find user by email
      const user = await User.findOne({otp: hashedToken, otp_expires_in: {$gt: Date.now()}});
      if (!user) {
        throw new Error('Invalid or expired reset link');
      }
      const hashedPassword = await bcrypt.hash(newPassword, 12);
      // Reset the user's password and clear OTP data
      user.password = hashedPassword;
      user.otp = undefined;
      user.otp_expires_in = undefined;

      // Save the updated user with the new password
      await user.save();
      await notificationService.sendMail(
        user.firstname,
        user.email,
        'Password Reset',
        `Your password was reset succesifully,
          Login with the new password `,
      );
      return 'Password reset successful';
    } catch (error) {
      throw error;
    }
  }
}

module.exports = UserService;
