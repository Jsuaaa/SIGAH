const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { NODE_ENV } = require('./config/env');

const app = express();

// Global middlewares
app.use(cors());
app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok' });
});

// In production, serve the compiled React frontend
if (NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../../client/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

module.exports = app;
