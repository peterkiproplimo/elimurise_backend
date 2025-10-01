const Role = require('../../models/portal/auth/roles');

class RoleService {
  // Function to create a new role
  static async createRole(name, permissions) {
    try {
      const newRole = new Role({name, permissions});
      const savedRole = await newRole.save();
      return savedRole;
    } catch (error) {
      throw new Error(`Error creating role ${error.message}`);
    }
  }

  // Function to get all roles
  static async getAllRoles() {
    try {
      const roles = await Role.find();
      return roles;
    } catch (error) {
      throw new Error('Error fetching roles');
    }
  }

  // Function to get a role by ID
  static async getRoleById(roleId) {
    try {
      const role = await Role.findById(roleId);
      return role;
    } catch (error) {
      throw new Error('Error fetching role');
    }
  }

  // Function to update a role by ID
  static async updateRoleById(roleId, updatedRole) {
    try {
      const role = await Role.findByIdAndUpdate(roleId, updatedRole, {
        new: true,
      });
      return role;
    } catch (error) {
      throw error;
    }
  }

  // Function to delete a role by ID
  static async deleteRoleById(roleId) {
    try {
      const deletedRole = await Role.findByIdAndDelete(roleId);
      return deletedRole;
    } catch (error) {
      throw new Error('Error deleting role');
    }
  }
  static async getRolesWithPagination(query, skip, limit) {
    // Replace with your actual implementation to fetch roles with pagination
    return Role.find(query).skip(skip).limit(limit);
  }

  static async countRoles(query) {
    // Replace with your actual implementation to count roles
    return Role.countDocuments(query);
  }
}

module.exports = RoleService;
