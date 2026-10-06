const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

class UserService {
  constructor() {
    this.filePath = path.join(__dirname, '../../data/users.json');
    this.ensureFileAndDefaultAdmin();
  }

  // Hash password using SHA-256 with salt
  hashPassword(password, salt) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
  }

  ensureFileAndDefaultAdmin() {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.filePath)) {
      // Create initial default admin user from env or fallback
      const defaultAdminUser = process.env.ADMIN_USER || 'admin';
      const defaultAdminPass = process.env.ADMIN_PASS || 'skillversity123';
      const { salt, hash } = this.hashPassword(defaultAdminPass);

      const initialUsers = [{
        id: 'usr_admin_001',
        username: defaultAdminUser,
        salt,
        hash,
        fullName: 'Skillversity IT Administrator',
        email: process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitycomplaints@gmail.com',
        phone: '+91 9876543210',
        role: 'Super Admin',
        department: 'IT OPERATIONS',
        createdAt: new Date().toISOString(),
        createdBy: 'System Default'
      }];

      fs.writeFileSync(this.filePath, JSON.stringify(initialUsers, null, 2), 'utf8');
    }
  }

  getAllUsers() {
    try {
      this.ensureFileAndDefaultAdmin();
      const content = fs.readFileSync(this.filePath, 'utf8');
      const users = JSON.parse(content) || [];
      // Sanitize: omit salt and hash when returning user lists
      return users.map(u => ({
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        department: u.department,
        createdAt: u.createdAt,
        createdBy: u.createdBy
      }));
    } catch (error) {
      console.error('Error reading users file:', error.message);
      return [];
    }
  }

  getUserByUsername(username) {
    try {
      this.ensureFileAndDefaultAdmin();
      const content = fs.readFileSync(this.filePath, 'utf8');
      const users = JSON.parse(content) || [];
      return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    } catch (error) {
      return null;
    }
  }

  getUserById(id) {
    try {
      this.ensureFileAndDefaultAdmin();
      const content = fs.readFileSync(this.filePath, 'utf8');
      const users = JSON.parse(content) || [];
      const user = users.find(u => u.id === id);
      if (!user) return null;
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        department: user.department,
        createdAt: user.createdAt
      };
    } catch (error) {
      return null;
    }
  }

  createUser({ username, password, fullName, email, phone, role = 'IT Tech', department = 'IT OPERATIONS', createdBy = 'Admin' }) {
    this.ensureFileAndDefaultAdmin();

    const existing = this.getUserByUsername(username);
    if (existing) {
      throw new Error(`Username '${username}' already exists. Please choose a different username.`);
    }

    const { salt, hash } = this.hashPassword(password);
    const userId = `usr_${Date.now().toString().slice(-6)}`;

    const newUser = {
      id: userId,
      username: username.trim(),
      salt,
      hash,
      fullName: fullName ? fullName.trim() : username.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      role: role || 'IT Tech',
      department: department || 'IT OPERATIONS',
      createdAt: new Date().toISOString(),
      createdBy
    };

    const content = fs.readFileSync(this.filePath, 'utf8');
    const users = JSON.parse(content) || [];
    users.push(newUser);
    fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');

    return {
      id: newUser.id,
      username: newUser.username,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      department: newUser.department,
      createdAt: newUser.createdAt
    };
  }

  updateUser(id, updateData) {
    this.ensureFileAndDefaultAdmin();
    const content = fs.readFileSync(this.filePath, 'utf8');
    const users = JSON.parse(content) || [];

    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User account not found.');
    }

    const user = users[index];

    if (updateData.fullName !== undefined) user.fullName = updateData.fullName.trim();
    if (updateData.email !== undefined) user.email = updateData.email.trim();
    if (updateData.phone !== undefined) user.phone = updateData.phone.trim();
    if (updateData.role !== undefined) user.role = updateData.role;
    if (updateData.department !== undefined) user.department = updateData.department;

    if (updateData.password && updateData.password.trim().length > 0) {
      const { salt, hash } = this.hashPassword(updateData.password.trim());
      user.salt = salt;
      user.hash = hash;
    }

    user.updatedAt = new Date().toISOString();
    users[index] = user;
    fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');

    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      updatedAt: user.updatedAt
    };
  }

  deleteUser(id) {
    this.ensureFileAndDefaultAdmin();
    const content = fs.readFileSync(this.filePath, 'utf8');
    let users = JSON.parse(content) || [];

    const targetUser = users.find(u => u.id === id);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    if (users.length <= 1) {
      throw new Error('Cannot delete the last remaining admin user.');
    }

    users = users.filter(u => u.id !== id);
    fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');
    return true;
  }

  // Authenticate login strictly against active users
  authenticate(username, password) {
    if (!username || !password) return null;

    const user = this.getUserByUsername(username);
    if (!user) return null;

    const { hash } = this.hashPassword(password, user.salt);
    if (hash === user.hash) {
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department
      };
    }

    return null;
  }
}

module.exports = new UserService();
