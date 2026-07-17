require('dotenv').config();

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { nanoid } = require('nanoid');
const db = require('./db/database');

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

app.use(helmet());
app.use(express.urlencoded({ extended: true }));

// Limit the shorten route to 10 requests per minute per IP
const shortenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Too many requests, please slow down.',
});

app.get('/', (req, res) => {
  res.render('index', { shortUrl: null, error: null });
});

app.post('/shorten', shortenLimiter, (req, res) => {
  const { url } = req.body;

  try {
    new URL(url);
  } catch {
    return res.render('index', { shortUrl: null, error: 'Please enter a valid URL.' });
  }

  const code = nanoid(7);
  db.prepare('INSERT INTO urls (code, original_url) VALUES (?, ?)').run(code, url);

  res.render('index', { shortUrl: `${BASE_URL}/${code}`, error: null });
});

app.get('/:code', (req, res) => {
  const row = db.prepare('SELECT original_url FROM urls WHERE code = ?').get(req.params.code);

  if (!row) {
    return res.status(404).render('not-found');
  }

  res.redirect(row.original_url);
});

// Basic error handler so users never see a raw stack trace
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).send('Something went wrong on our end.');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
