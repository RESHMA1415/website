import mongoose from 'mongoose';

// Proof that an account deletion request was carried out (DPDP Act). Holds no
// personal data: only the former account id, when, and who asked.
const deletionLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, required: true },
    requestedBy: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    reason: String,
    ordersKept: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export default mongoose.model('DeletionLog', deletionLogSchema);
