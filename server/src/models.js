const mongoose = require('mongoose');
const { Schema } = mongoose;

const REASONS = ['Defective', 'Wrong item sent', 'Not as described', 'Damaged in shipping',
  'Size or fit', 'Changed mind', 'Late delivery', 'Other'];

const Product = mongoose.model('Product', new Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  sku: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 40 },
  supplier: { type: String, required: true, trim: true, maxlength: 100 },
  unitsSold: { type: Number, required: true, min: 0, validate: Number.isInteger }
}, { timestamps: true }));

const Return = mongoose.model('Return', new Schema({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
  reason: { type: String, enum: REASONS, required: true },
  quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
  returnDate: { type: Date, default: Date.now, index: true },
  notes: { type: String, trim: true, maxlength: 500, default: '' }
}, { timestamps: true }));

const Setting = mongoose.model('Setting', new Schema({
  key: { type: String, default: 'main', unique: true },
  threshold: { type: Number, default: 10, min: 0, max: 100 }
}));

const getSettings = async () =>
  (await Setting.findOne({ key: 'main' })) || Setting.create({ key: 'main' });

module.exports = { Product, Return, Setting, REASONS, getSettings };
