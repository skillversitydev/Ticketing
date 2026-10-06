const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./src/config/config');
const complaintRoutes = require('./src/routes/complaintRoutes');
const { router: authRoutes } = require('./src/routes/authRoutes');
const userRoutes = require('./src/routes/userRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend assets & uploaded media files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/complaints', complaintRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Skillversity IT Support & Complaint System', timestamp: new Date().toISOString() });
});

// Fallback to index.html for SPA navigation
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
const PORT = config.port;
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🎓 Skillversity IT Support & Complaint Web App is running!`);
  console.log(`🌐 Employee Portal: http://localhost:${PORT}`);
  console.log(`🔐 Admin Login: http://localhost:${PORT}/login.html`);
  console.log(`📋 Admin Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`📧 Target Notification Email: ${config.targetEmail}`);
  console.log(`=======================================================`);
});
