require('dotenv').config();
const mongoose = require('mongoose');
const { Product, Return, Setting } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/returniq');
  await Promise.all([Product.deleteMany(), Return.deleteMany(), Setting.deleteMany()]);
  await Setting.create({ key: 'main', threshold: 10 });
  const P = await Product.insertMany([
    { name: 'Canvas Tote Bag', sku: 'TOTE-01', supplier: 'Northline Textiles', unitsSold: 200 },
    { name: 'Steel Water Bottle', sku: 'BOTL-02', supplier: 'Brightware Co', unitsSold: 150 },
    { name: 'Wireless Earbuds', sku: 'AUD-10', supplier: 'SonicParts Ltd', unitsSold: 80 },
    { name: 'Linen Shirt', sku: 'SHRT-07', supplier: 'Northline Textiles', unitsSold: 120 }
  ]);
  const d = n => new Date(Date.now() - n * 864e5);
  const mk = (i, reason, quantity, days) => ({ product: P[i]._id, reason, quantity, returnDate: d(days) });
  await Return.insertMany([
    mk(0, 'Defective', 3, 5), mk(1, 'Damaged in shipping', 4, 12), mk(2, 'Defective', 6, 3),
    mk(2, 'Defective', 5, 40), mk(2, 'Not as described', 3, 70), mk(3, 'Size or fit', 9, 8),
    mk(3, 'Size or fit', 7, 35), mk(3, 'Changed mind', 2, 60), mk(0, 'Changed mind', 2, 45), mk(1, 'Late delivery', 2, 90)
  ]);
  console.log('Seeded.'); process.exit(0);
})();
