import mongoose from 'mongoose';

const sizeChartSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['men_clothing', 'women_clothing', 'footwear', 'other'] },
    imageUrl: String,
    // Table form: column headings + one row per size
    columns: [String],
    rows: [[String]],
  },
  { timestamps: true },
);

export default mongoose.model('SizeChart', sizeChartSchema);
