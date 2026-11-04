import mongoose from 'mongoose';

// Running numbers, e.g. the daily sequence in SHM-YYMMDD-XXXX order numbers
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export default mongoose.model('Counter', counterSchema);
