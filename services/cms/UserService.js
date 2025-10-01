const User = require('../../models/cms/auth/User');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const NotificationService = require('../../services/NotificationService');
const Role = require('../../models/cms/auth/roles');
const notificationService = new NotificationService();
class UserService {
  async createUser(userData) {
    try {
      const {firstname, lastname, phone, email, avater, role_id, status, password, workflow_state} = userData;

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
        role_id,
        workflow_state,
        password: hashedPassword,
      });
      await this.welcomeMessage(email, password);
      // await this.sendOTP(email);
      return newUser;
    } catch (error) {
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
      console.log(updatedData);
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
  async findByEmail(email) {
    try {
      const user = await User.findOne({email});
      if (!user) {
        throw new Error('User not found');
      }
      return user;
    } catch (error) {
      throw error;
    }
  }
  async sendOTP(email) {
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

      const resetLink = `${process.env.CMSURL}reset-password/${resetToken}`;
      // console.log(resetLink);
      // Generate a random OTP
      // await notificationService.sendMail(
      //   user.firstname,
      //   email,
      //   'Password Reset Link',
      //   `
      //     <p>You requested a password reset. Click the button below to reset your password:</p>
      //     <a href="${resetLink}"
      //       style="
      //         display: inline-block;
      //         background-color: #007bff;
      //         color: #ffffff;
      //         padding: 10px 20px;
      //         text-align: center;
      //         text-decoration: none;
      //         font-size: 16px;
      //         border-radius: 5px;
      //       ">
      //       Reset Password
      //     </a>
      //     <br/> <br/><br/>or click ${resetLink}
      //     <p>If you did not request this, please ignore this email.</p>
      //     <p>Thanks, `,
      // );
      console.log(resetLink);
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
  async welcomeMessage(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({email});

      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }

      // Simulate sending a welcome email with OTP
      await notificationService.sendMail(
        user.firstname,
        email,
        'Welcome to Elimurise',
        `
        <p>Dear ${user.firstname},</p>
        <p>Welcome to Elimurise! We are excited to have you onboard.</p>
        <p>Use this link to access the system:${process.env.CMSURL}</p>
        <p>Your login credentials are as follows:</p>
        <p><strong>Email:</strong> <center><h1>${email}</h1></center></p>
        <p><strong>Password:</strong> <center><h1>${password}</h1></center></p>
        <p>Please keep these details secure and do not share them with anyone.</p>
        <p>Best regards,</p>
        <p>The Elimurise Team</p>
        <p><em>Powered by Techsavanna</em></p>
        `,
      );

      // Save the user with the OTP details
      await user.save();

      return 'Welcome message sent successfully ';
    } catch (error) {
      throw error;
    }
  }
  async getProfile(req, res) {
    try {
      const user = await User.findById(req.user);

      // Log user details for debugging

      // Fetch the role from the database
      const role = await Role.findById(user.role_id);

      if (!role) {
        return res.status(404).json({success: false, message: 'Role not found'});
      }

      // Attach the role to the user
      user.role_id = role;

      // Return the user data with role information
      return res.status(200).json({success: true, data: user, message: 'Profile Updated Successfully'});
    } catch (error) {
      // Handle any errors that occur during the process
      console.error(error);
      return res.status(404).json({success: false, message: 'Server error'});
    }
  }
}

module.exports = UserService;
