require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth, requireOrg } = require('./middleware/auth');

const app = express();
app.use(cors());
app.use(express.json());

// ----- Health check (no auth needed) -----
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'NPS backend running' });
});

// ----- Every route below requires a valid logged-in user -----
app.use('/api', requireAuth);

// Auth check (confirms the admin panel's login token is valid)
app.get('/api/auth/me', (req, res) => {
  res.json({ user: req.user, profile: req.profile });
});

// Organization setup / info - deliberately NOT behind requireOrg,
// since this is exactly how a user without an org yet gets one.
app.use('/api/organizations', require('./routes/organizations'));

// Team/user management
app.use('/api/users', require('./routes/users'));

// ----- Business modules - all require an organization to exist -----
app.use('/api/machines', requireOrg, require('./routes/machines'));
app.use('/api/cloth-types', requireOrg, require('./routes/clothTypes'));
app.use('/api/products', requireOrg, require('./routes/products'));
app.use('/api/employees', requireOrg, require('./routes/employees'));
app.use('/api/customers', requireOrg, require('./routes/customers'));
app.use('/api/production', requireOrg, require('./routes/production'));
app.use('/api/deliveries', requireOrg, require('./routes/deliveries'));
app.use('/api/expenses', requireOrg, require('./routes/expenses'));
app.use('/api/reports', requireOrg, require('./routes/reports'));

// ----- 404 fallback -----
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ----- Global error handler (catches anything unexpected) -----
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Something went wrong on the server' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`NPS backend running on http://localhost:${PORT}`);
});
