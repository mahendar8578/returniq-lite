require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware');

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || true }));
app.use(express.json({ limit: '100kb' }));

// Cached connection: works for both a long-running server and Vercel serverless.
let conn;
const connectDB = () => (conn ||= mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/returniq'));
app.use(async (req, res, next) => { try { await connectDB(); next(); } catch (e) { conn = null; next(e); } });

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api', routes);
app.use(notFound);
app.use(errorHandler);

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => console.log(`ReturnIQ API on http://localhost:${PORT}`));
}
module.exports = app;
