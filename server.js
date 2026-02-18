require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { getDb } = require('./db/init');
const { syncFromN8n } = require('./db/sync');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize DB
getDb();

// Routes
app.use('/', require('./routes/pages'));
app.use('/api', require('./routes/api'));

// Startup sync from n8n
syncFromN8n().then(() => {
  console.log('Initial n8n sync complete');
}).catch(err => {
  console.error('n8n sync error (non-fatal):', err.message);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cana Lead System V2 running on port ${PORT}`);
});
