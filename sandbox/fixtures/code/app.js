// Main application file
const express = require('express');
const app = express();

// Configure middleware
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.get('/api/users', (req, res) => {
  // TODO: Implement user fetching
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  // TODO: Implement user creation
  res.status(201).json({ message: 'User created' });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Internal Server Error');
});

module.exports = app;
