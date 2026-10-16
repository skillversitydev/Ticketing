const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

class UserService {
  constructor() {
    this.filePath = path.join(__dirname, '../../data/users.json');
    this.memoryUsers = null;
    this.ensureFileAndDefaultAdmin();
  }

  // Hash password using SHA-512 with salt
  hashPassword(password, salt) {
    if (!salt) {
      salt = crypto.randomBytes(16).toString('hex');
    }
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { salt, hash };
  }

  ensureFileAndDefaultAdmin() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      if (!fs.existsSync(this.filePath)) {
        const defaultAdminUser = process.env.ADMIN_USER || 'pladmin';
        const defaultAdminPass = process.env.ADMIN_PASS || 'pladmin123';
        const { salt, hash } = this.hashPassword(defaultAdminPass);

        const initialUsers = [{
          id: 'usr_admin_001',
          username: defaultAdminUser,
          password: defaultAdminPass,
          salt,
          hash,
          fullName: 'Skillversity IT Administrator',
          email: process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitydev@gmail.com',
          phone: '+91 9876543210',
          role: 'Super Admin',
          department: 'IT OPERATIONS',
          createdAt: new Date().toISOString(),
          createdBy: 'System Default'
        }];

        fs.writeFileSync(this.filePath, JSON.stringify(initialUsers, null, 2), 'utf8');
      }
    } catch (err) {
      console.warn('UserService initialization warning (read-only environment):', err.message);
    }
  }

  getRawUsers() {
    if (this.memoryUsers) return this.memoryUsers;
    try {
      this.ensureFileAndDefaultAdmin();
      const content = fs.readFileSync(this.filePath, 'utf8');
      const loaded = JSON.parse(content) || [];
      this.memoryUsers = loaded.map(u => {
        if (!u.password) {
          u.password = process.env.ADMIN_PASS || 'pladmin123';
        }
        return u;
      });
      return this.memoryUsers;
    } catch (error) {
      if (!this.memoryUsers) {
        const defaultAdminUser = process.env.ADMIN_USER || 'pladmin';
        const defaultAdminPass = process.env.ADMIN_PASS || 'pladmin123';
        const { salt, hash } = this.hashPassword(defaultAdminPass);
        this.memoryUsers = [{
          id: 'usr_admin_001',
          username: defaultAdminUser,
          password: defaultAdminPass,
          salt,
          hash,
          fullName: 'Skillversity IT Administrator',
          email: process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitydev@gmail.com',
          phone: '+91 9876543210',
          role: 'Super Admin',
          department: 'IT OPERATIONS',
          createdAt: new Date().toISOString(),
          createdBy: 'System Default'
        }];
      }
      return this.memoryUsers;
    }
  }

  getAllUsers(isPladmin = false) {
    const users = this.getRawUsers();
    return users.map(u => {
      const userObj = {
        id: u.id,
        username: u.username,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        role: u.role,
        department: u.department,
        createdAt: u.createdAt,
        createdBy: u.createdBy
      };
      if (isPladmin) {
        userObj.password = u.password || 'pladmin123';
      }
      return userObj;
    });
  }

  getUserByUsername(username) {
    const users = this.getRawUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
  }

  getUserById(id, isPladmin = false) {
    const users = this.getRawUsers();
    const user = users.find(u => u.id === id);
    if (!user) return null;
    const userObj = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      createdAt: user.createdAt,
      createdBy: user.createdBy
    };
    if (isPladmin) {
      userObj.password = user.password || 'pladmin123';
    }
    return userObj;
  }

  createUser({ username, password, fullName, email, phone, role = 'IT Support', department = 'IT OPERATIONS', createdBy = 'pladmin' }) {
    const existing = this.getUserByUsername(username);
    if (existing) {
      throw new Error(`Username '${username}' already exists. Please choose a different username.`);
    }

    const trimmedPassword = (password || '').trim();
    if (!trimmedPassword || trimmedPassword.length < 4) {
      throw new Error('Password must be at least 4 characters long.');
    }

    // Strictly limit roles to the 3 defined system roles
    const validRoles = ['Superadmin', 'Admin', 'IT Support'];
    let assignedRole = role || 'IT Support';
    if (!validRoles.includes(assignedRole)) {
      assignedRole = 'IT Support';
    }

    const { salt, hash } = this.hashPassword(trimmedPassword);
    const userId = `usr_${Date.now().toString().slice(-6)}`;

    const newUser = {
      id: userId,
      username: username.trim(),
      password: trimmedPassword,
      salt,
      hash,
      fullName: fullName ? fullName.trim() : username.trim(),
      email: email ? email.trim() : '',
      phone: phone ? phone.trim() : '',
      role: assignedRole,
      department: department || 'IT OPERATIONS',
      createdAt: new Date().toISOString(),
      createdBy
    };

    const users = this.getRawUsers();
    users.push(newUser);
    this.memoryUsers = users;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
      console.warn('UserService write warning (read-only filesystem):', err.message);
    }

    return {
      id: newUser.id,
      username: newUser.username,
      password: newUser.password,
      fullName: newUser.fullName,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      department: newUser.department,
      createdAt: newUser.createdAt,
      createdBy: newUser.createdBy
    };
  }

  updateUser(id, updateData, isPladmin = false) {
    const users = this.getRawUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) {
      throw new Error('User account not found.');
    }

    const user = users[index];

    if (updateData.fullName !== undefined) user.fullName = updateData.fullName.trim();
    if (updateData.email !== undefined) user.email = updateData.email.trim();
    if (updateData.phone !== undefined) user.phone = updateData.phone.trim();
    if (user.username.toLowerCase() === 'pladmin') {
      user.role = 'Superadmin';
    } else if (updateData.role !== undefined) {
      const validRoles = ['Superadmin', 'Admin', 'IT Support'];
      if (validRoles.includes(updateData.role)) {
        user.role = updateData.role;
      }
    }
    if (updateData.department !== undefined) user.department = updateData.department;

    if (updateData.password && updateData.password.trim().length > 0) {
      const trimmedPass = updateData.password.trim();
      if (trimmedPass.length < 4) {
        throw new Error('Password must be at least 4 characters long.');
      }
      user.password = trimmedPass;
      const { salt, hash } = this.hashPassword(trimmedPass);
      user.salt = salt;
      user.hash = hash;
    }

    user.updatedAt = new Date().toISOString();
    users[index] = user;
    this.memoryUsers = users;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
      console.warn('UserService update warning (read-only filesystem):', err.message);
    }

    const result = {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      department: user.department,
      updatedAt: user.updatedAt
    };
    if (isPladmin) {
      result.password = user.password || 'pladmin123';
    }
    return result;
  }

  deleteUser(id) {
    let users = this.getRawUsers();
    const targetUser = users.find(u => u.id === id);
    if (!targetUser) {
      throw new Error('User not found.');
    }

    if (targetUser.username.toLowerCase() === 'pladmin' || targetUser.role === 'Superadmin' || targetUser.role === 'Super Admin' || users.length <= 1) {
      throw new Error('Cannot delete the primary "Superadmin" (pladmin) account.');
    }

    users = users.filter(u => u.id !== id);
    this.memoryUsers = users;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(users, null, 2), 'utf8');
    } catch (err) {
      console.warn('UserService delete warning (read-only filesystem):', err.message);
    }

    return true;
  }

  // Authenticate login strictly against active users
  authenticate(username, password) {
    if (!username || !password) return null;

    const user = this.getUserByUsername(username);
    if (!user) return null;

    // Direct password match OR salt/hash match
    if (user.password && user.password === password) {
      return {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department
      };
    }

    if (user.salt && user.hash) {
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
    }

    return null;
  }

  syncWithSheetUsers(sheetUsers = []) {
    const currentUsers = this.getRawUsers();
    const userMap = new Map();

    // 1. Index all existing local users first so accounts and passwords are not lost
    for (const u of currentUsers) {
      if (u && u.username) {
        const key = u.username.trim().toLowerCase();
        userMap.set(key, { ...u, password: u.password || 'pladmin123' });
      }
    }

    // 2. Merge non-duplicate sheet users
    if (Array.isArray(sheetUsers)) {
      for (const su of sheetUsers) {
        const key = su.username ? su.username.trim().toLowerCase() : "";
        if (!key) continue;

        if (userMap.has(key)) {
          const existing = userMap.get(key);
          userMap.set(key, {
            ...existing,
            fullName: su.fullName || existing.fullName,
            email: su.email || existing.email,
            phone: su.phone || existing.phone,
            role: su.role || existing.role,
            department: su.department || existing.department
          });
        } else {
          const defaultPass = process.env.ADMIN_PASS || 'pladmin123';
          const { salt, hash } = this.hashPassword(defaultPass);
          userMap.set(key, {
            id: su.id || `usr_${Date.now()}_${Math.floor(Math.random()*1000)}`,
            username: su.username.trim(),
            password: defaultPass,
            salt,
            hash,
            fullName: su.fullName || su.username.trim(),
            email: su.email || '',
            phone: su.phone || '',
            role: su.role || 'IT Tech',
            department: su.department || 'IT OPERATIONS',
            createdAt: su.createdAt || new Date().toISOString(),
            createdBy: su.createdBy || 'Google Sheet Import'
          });
        }
      }
    }

    // 3. Ensure pladmin is always preserved as Super Admin
    const adminUser = (process.env.ADMIN_USER || 'pladmin').toLowerCase();
    if (!userMap.has(adminUser)) {
      const defaultPass = process.env.ADMIN_PASS || 'pladmin123';
      const { salt, hash } = this.hashPassword(defaultPass);
      userMap.set(adminUser, {
        id: 'usr_admin_001',
        username: process.env.ADMIN_USER || 'pladmin',
        password: defaultPass,
        salt,
        hash,
        fullName: 'Skillversity IT Administrator',
        email: process.env.TARGET_NOTIFICATION_EMAIL || 'skillversitydev@gmail.com',
        phone: '+91 9876543210',
        role: 'Super Admin',
        department: 'IT OPERATIONS',
        createdAt: new Date().toISOString(),
        createdBy: 'System Default'
      });
    }

    const mergedUsers = Array.from(userMap.values());
    this.memoryUsers = mergedUsers;

    try {
      fs.writeFileSync(this.filePath, JSON.stringify(mergedUsers, null, 2), 'utf8');
    } catch (err) {
      console.warn('UserService sync write warning:', err.message);
    }

    return this.getAllUsers(true);
  }

  mergeUsersFromSheet(sheetUsers = []) {
    return this.syncWithSheetUsers(sheetUsers);
  }
}

module.exports = new UserService();
