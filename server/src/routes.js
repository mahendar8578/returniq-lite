const router = require('express').Router();
const { body, param, query } = require('express-validator');
const { Product, Return, REASONS, getSettings } = require('./models');
const { HttpError, validate, wrap } = require('./middleware');

const idParam = param('id').isMongoId().withMessage('Invalid id');

/* ---------- Products ---------- */
const productRules = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('sku').trim().notEmpty().withMessage('SKU is required').isLength({ max: 40 }),
  body('supplier').trim().notEmpty().withMessage('Supplier is required').isLength({ max: 100 }),
  body('unitsSold').isInt({ min: 0 }).withMessage('Units sold must be a whole number, 0 or more').toInt()
];

router.get('/products', wrap(async (req, res) => res.json(await Product.find().sort('name'))));
router.post('/products', productRules, validate, wrap(async (req, res) => {
  const { name, sku, supplier, unitsSold } = req.body;
  res.status(201).json(await Product.create({ name, sku, supplier, unitsSold }));
}));
router.put('/products/:id', idParam, productRules, validate, wrap(async (req, res) => {
  const { name, sku, supplier, unitsSold } = req.body;
  const p = await Product.findByIdAndUpdate(req.params.id, { name, sku, supplier, unitsSold }, { new: true, runValidators: true });
  if (!p) throw new HttpError(404, 'Product not found');
  res.json(p);
}));
router.delete('/products/:id', idParam, validate, wrap(async (req, res) => {
  const p = await Product.findByIdAndDelete(req.params.id);
  if (!p) throw new HttpError(404, 'Product not found');
  await Return.deleteMany({ product: p._id });
  res.status(204).end();
}));

/* ---------- Returns ---------- */
const returnRules = [
  body('product').isMongoId().withMessage('Choose a valid product'),
  body('reason').isIn(REASONS).withMessage('Choose a valid reason category'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be a whole number, 1 or more').toInt(),
  body('returnDate').optional({ values: 'falsy' }).isISO8601().withMessage('Invalid date')
    .custom(v => new Date(v) <= new Date()).withMessage('Return date cannot be in the future'),
  body('notes').optional().trim().isLength({ max: 500 }).withMessage('Notes max 500 characters')
];

router.get('/returns', [
  query('reason').optional({ values: 'falsy' }).isIn(REASONS),
  query('product').optional({ values: 'falsy' }).isMongoId(),
  query('from').optional({ values: 'falsy' }).isISO8601(),
  query('to').optional({ values: 'falsy' }).isISO8601()
], validate, wrap(async (req, res) => {
  const { reason, product, from, to } = req.query, f = {};
  if (reason) f.reason = reason;
  if (product) f.product = product;
  if (from || to) f.returnDate = { ...(from && { $gte: new Date(from) }), ...(to && { $lte: new Date(to) }) };
  res.json(await Return.find(f).populate('product', 'name sku supplier').sort('-returnDate').limit(300));
}));

router.post('/returns', returnRules, validate, wrap(async (req, res) => {
  if (!(await Product.exists({ _id: req.body.product }))) throw new HttpError(404, 'Product not found');
  const { product, reason, quantity, returnDate, notes } = req.body;
  res.status(201).json(await Return.create({ product, reason, quantity, returnDate: returnDate || undefined, notes }));
}));
router.put('/returns/:id', idParam, returnRules, validate, wrap(async (req, res) => {
  const { product, reason, quantity, returnDate, notes } = req.body;
  const r = await Return.findByIdAndUpdate(req.params.id, { product, reason, quantity, returnDate, notes }, { new: true, runValidators: true });
  if (!r) throw new HttpError(404, 'Return not found');
  res.json(r);
}));
router.delete('/returns/:id', idParam, validate, wrap(async (req, res) => {
  if (!(await Return.findByIdAndDelete(req.params.id))) throw new HttpError(404, 'Return not found');
  res.status(204).end();
}));

/* ---------- Settings ---------- */
router.get('/settings', wrap(async (req, res) => res.json(await getSettings())));
router.put('/settings', body('threshold').isFloat({ min: 0, max: 100 }).withMessage('Threshold must be between 0 and 100').toFloat(),
  validate, wrap(async (req, res) => {
    const s = await getSettings();
    s.threshold = req.body.threshold;
    res.json(await s.save());
  }));

/* ---------- Analytics ---------- */
async function productStats() {
  const [products, agg, s] = await Promise.all([
    Product.find().lean(),
    Return.aggregate([{ $group: { _id: '$product', returned: { $sum: '$quantity' } } }]),
    getSettings()
  ]);
  const map = new Map(agg.map(a => [String(a._id), a.returned]));
  const stats = products.map(p => {
    const returned = map.get(String(p._id)) || 0;
    const rate = p.unitsSold > 0 ? +((returned / p.unitsSold) * 100).toFixed(1) : (returned > 0 ? 100 : 0);
    return { ...p, returned, rate, flagged: rate > s.threshold };
  }).sort((a, b) => b.rate - a.rate);
  return { threshold: s.threshold, stats };
}

router.get('/analytics/products', wrap(async (req, res) => res.json(await productStats())));

router.get('/analytics/flagged', wrap(async (req, res) => {
  const { threshold, stats } = await productStats();
  res.json({ threshold, products: stats.filter(p => p.flagged) });
}));

router.get('/analytics/summary', wrap(async (req, res) => {
  const [{ threshold, stats }, byReason] = await Promise.all([
    productStats(),
    Return.aggregate([{ $group: { _id: '$reason', units: { $sum: '$quantity' }, entries: { $sum: 1 } } }, { $sort: { units: -1 } }])
  ]);
  const sup = {};
  stats.forEach(p => {
    const s = sup[p.supplier] ||= { supplier: p.supplier, sold: 0, returned: 0, products: 0 };
    s.sold += p.unitsSold; s.returned += p.returned; s.products++;
  });
  const suppliers = Object.values(sup).map(s => ({ ...s, rate: s.sold ? +((s.returned / s.sold) * 100).toFixed(1) : 0 })).sort((a, b) => b.rate - a.rate);
  const totalReturned = stats.reduce((n, p) => n + p.returned, 0);
  const totalSold = stats.reduce((n, p) => n + p.unitsSold, 0);
  res.json({
    threshold, totalReturned, totalSold, products: stats.length,
    overallRate: totalSold ? +((totalReturned / totalSold) * 100).toFixed(1) : 0,
    flaggedCount: stats.filter(p => p.flagged).length,
    byReason: byReason.map(r => ({ reason: r._id, units: r.units, entries: r.entries })), suppliers
  });
}));

router.get('/analytics/trends', wrap(async (req, res) => {
  const rows = await Return.aggregate([
    { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$returnDate' } }, reason: '$reason' }, units: { $sum: '$quantity' } } },
    { $sort: { '_id.month': 1 } }
  ]);
  const months = {};
  rows.forEach(r => {
    const m = months[r._id.month] ||= { month: r._id.month, total: 0, reasons: {} };
    m.reasons[r._id.reason] = r.units; m.total += r.units;
  });
  res.json(Object.values(months).slice(-12));
}));

module.exports = router;
