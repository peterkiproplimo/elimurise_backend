const Parent = require('../../models/portal/content/Parent');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const mongoose = require('mongoose');
const NotificationService = require('../../services/NotificationService');
const {json} = require('stream/consumers');
const {Queue} = require('bullmq');
const emailQueue = new Queue('emailQueue');

const notificationService = new NotificationService();

class ParentService {
  async getParents(page = 1, limit, searchQuery = {}, sortField, sortDirection) {
    try {
      if (!limit) {
        const parents = await Parent.find({school: searchQuery.school});
        return {data: parents, message: 'Retrieved successifully'};
      }
      const skip = (page - 1) * limit;
      const sort = sortField ? {[sortField]: sortDirection === 'desc' ? -1 : 1} : {};
      console.log(sort);
      // Fetch parents with pagination
      const parents = await Parent.find(searchQuery).sort(sort).skip(skip).limit(limit).exec();

      // Count total parents matching the query
      const totalParents = await Parent.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalParents / limit);

      // Return paginated result
      return {
        data: parents,
        pagination: {
          current_page: page,
          total: totalParents,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch parents');
    }
  }
  async queueWelcomeEmails(school) {
    try {
      const parents = await Parent.find({school: school});
      console.log(parents);
      for (const parent of parents) {
        await emailQueue.add('sendWelcomeEmail', {parentId: parent._id, school});
      }

      return {message: 'Emails added to queue'};
    } catch (error) {
      throw new Error(`Failed to queue emails: ${error.message}`);
    }
  }

  async searchParents(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          {first_name: {$regex: searchRegex}},
          {last_name: {$regex: searchRegex}},
          {surname: {$regex: searchRegex}},
          // Add more fields to search here
        ],
      };
      return await this.getParents(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search parents');
    }
  }
  async generateRandomPassword(length = 12) {
    return crypto.randomBytes(length).toString('hex').slice(0, length);
  }

  async sendWelcomeMessage(guardianFirstName, guardianEmail, password, schoolCode) {
    const passwordText = password; // Use the generated password
    const message = `

  

<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0;">
    <table style="max-width: 600px; margin: 20px auto; background-color: #fff; border: 1px solid #ddd; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);">
        <tr>
           
        </tr>
        <tr>
            <td style="padding: 20px;">
               
                <p style="font-size: 16px; margin-bottom: 20px;">
                    Your account has been successfully created. Below are your login credentials:
                </p>
                <table style="width: 100%; margin-bottom: 20px; border-collapse: collapse;">
                    <tr>
                        <td style="font-size: 16px; padding: 8px 0;"><strong>Email:</strong></td>
                        <td style="font-size: 16px; padding: 8px 0;">${guardianEmail}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 16px; padding: 8px 0;"><strong>School Code:</strong></td>
                        <td style="font-size: 16px; padding: 8px 0;">${schoolCode}</td>
                    </tr>
                    <tr>
                        <td style="font-size: 16px; padding: 8px 0;"><strong>Password: </strong></td>
                        <td style="font-size: 16px; padding: 8px 0;"> ${passwordText}</td>
                    </tr>
                </table>
                <p style="font-size: 16px; margin-bottom: 20px;">
                    You can log in to your account using the button below:
                </p>
                <div style="text-align: center; margin-bottom: 20px;">
                    <a href="${process.env.URL}" 
                       style="display: inline-block; padding: 12px 20px; font-size: 16px; color: #fff; background-color: #007bff; text-decoration: none; border-radius: 5px;">
                        Login to Your Account
                    </a>
                </div>
                <p style="font-size: 14px; margin-bottom: 20px; color: #555;">
                    Please do not share your password with anyone. If you did not request this account or believe this email was sent in error, you can safely ignore it.
                </p>
              
            </td>
        </tr>
    </table>


    `;

    // Call the notification service to send the email
    await notificationService.sendMail(guardianFirstName, guardianEmail, 'Welcome to the Parents Portal', message);
  }

  async triggerWelcomeEmail(parentId, school) {
    try {
      // Fetch the parent by ID and school
      const parent = await Parent.findOne({_id: parentId, school});

      if (!parent) {
        throw new Error('Parent not found');
      }

      // Generate a new random password
      const randomPassword = await this.generateRandomPassword();

      // Hash the new password
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Update the parent's password
      await Parent.updateOne({_id: parentId, school}, {password: hashedPassword});

      // Send the welcome email
      await this.sendWelcomeMessage(parent.first_name, parent.email, randomPassword, parent.schoolCode);

      return {message: 'Welcome email sent successfully' + hashedPassword};
    } catch (error) {
      throw new Error('Failed to send welcome email: ' + error.message);
    }
  }

  async createParent(parentData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Generate a random password
      const randomPassword = await this.generateRandomPassword();
      console.log(parentData);
      
      // Only check for existing parent if ID number is provided
      let parentExistId = null;
      if (parentData.id_no) {
        parentExistId = await this.getOneParentByIdNo(parentData.id_no, parentData.school);
      }
      
      // Only check for existing parent if email is provided
      let parentExist = null;
      if (parentData.email) {
        parentExist = await this.getOneParentByEmailOrId(parentData.email, parentData.school);
      }
      
      if (parentExistId) {
        throw new Error('Parent ID Number already Exist');
      } else if (parentExist) {
        throw new Error('Parent Email already Exist');
      }
      
      // Hash the password before saving
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      // Create the parent data with the hashed password
      const parentInfo = {
        ...parentData,
        password: hashedPassword,
      };

      const parent = new Parent(parentInfo);
      const savedParent = await parent.save({session});

      // Send welcome message with the random password
      //   await this.sendWelcomeMessage(parentData.first_name, parentData.email, randomPassword, parentData.schoolCode);

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      return {message: 'Parent created successfully', parent: savedParent};
    } catch (error) {
      console.log(error);
      await session.abortTransaction();
      session.endSession();
      throw new Error(error.message);
    }
  }
  // async createParent(data) {
  //   try {
  //     const parent = new Parent(data);
  //     const savedParent = await parent.save();
  //     return savedParent;
  //   } catch (error) {
  //     throw new Error('Failed to create parent' + error.message);
  //   }
  // }

  async updateParent(id, data, school) {
    try {
      const parent = await Parent.findOneAndUpdate({_id: id, school}, data, {new: true});
      return parent;
    } catch (error) {
      throw new Error('Failed to update parent');
    }
  }
  async getOneParentByIdNo(id_no, school) {
    try {
      const parent = await Parent.findOne({id_no, school});
      return parent;
    } catch (error) {
      throw new Error('Failed to update parent');
    }
  }
  async getOneParent(query) {
    try {
      const parent = await Parent.findOne(query);
      return parent;
    } catch (error) {
      throw new Error('Failed to update parent');
    }
  }
  // async getOneParentById(id) {
  //   try {
  //     const parent = await Parent.findOne({id_no, school});
  //     return parent;
  //   } catch (error) {
  //     throw new Error('Failed to update parent');
  //   }
  // }
  async getOneParentByEmailOrId(search, school) {
    try {
      if (!search) {
        return null;
      }
      
      const query = {
        $or: [{email: search}, {id_no: search}],
        school: school,
      };
      console.log(query);

      const parent = await Parent.findOne(query);
      console.log(parent);

      return parent;
    } catch (error) {
      throw new Error('Failed to retrieve parent: ' + error.message);
    }
  }
  async deleteParent(id, school) {
    try {
      const deletedParent = await Parent.findOneAndDelete({_id: id, school});
      return deletedParent;
    } catch (error) {
      throw new Error('Failed to delete parent');
    }
  }
  async sendOTP(email, code) {
    try {
      // Find user by email
      const user = await Parent.findOne({email: email, schoolCode: code});

      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }
      // Generate a reset token
      const resetToken = crypto.randomBytes(32).toString('hex');

      // Hash the reset token to store it securely in the database
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

      const resetLink = `${process.env.SCHOOLURL}auth/v1/reset-password/${resetToken}`;
      // console.log(resetLink);
      // Generate a random OTP
      await notificationService.sendMail(
        user.first_name,
        email,
        'One Time Password(OTP)',
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
  // async sendOTP(email, code) {
  //   try {
  //     // Find user by email
  //     const user = await Parent.findOne({email: email, schoolCode: code});

  //     if (!user) {
  //       throw new Error('Provided email is not registered in our system');
  //     }

  //     // Generate a random OTP
  //     const OTP = Math.floor(100000 + Math.random() * 900000).toString();
  //     await notificationService.sendMail(
  //       user.guardian_email,
  //       email,
  //       'One Time Password(OTP)',
  //       `Your one time password is,
  //       <center><h1>${OTP}</h1></center>,<br/>
  //        Please Do not share with any one.
  //        <br/>If you didn't request for password reset
  //        please ignore this mail`,
  //     );

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
  async resetPassword(token, newPassword) {
    try {
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user by email
      // console.log({schoolCode: code});
      const user = await Parent.findOne({otp: hashedToken, otp_expires_in: {$gt: Date.now()}});
      if (!user) {
        throw new Error('Invalid or expired OTP');
      }
      console.log(user.otp_expires_in < Date.now());

      // Check if OTP has expired or is incorrect

      const hashedPassword = await bcrypt.hash(newPassword, 12);
      // Reset the user's password and clear OTP data
      user.password = hashedPassword;
      user.otp = undefined;
      user.otp_expires_in = undefined;

      // Save the updated user with the new password
      await user.save();
      await notificationService.sendMail(
        user.first_name,
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

module.exports = ParentService;
