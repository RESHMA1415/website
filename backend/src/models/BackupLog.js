import mongoose from 'mongoose';

// One row per nightly (or "Back up now") database backup, shown in the admin.
// Holds no customer data: only where the copy went and how big it was.
const backupLogSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ['ok', 'partial', 'failed'], required: true },
    trigger: { type: String, enum: ['nightly', 'admin'], default: 'nightly' },
    fileName: String,
    bytes: Number,
    collections: Number,
    documents: Number,
    encrypted: Boolean,
    cloud: { saved: Boolean, publicId: String, error: String },
    local: { saved: Boolean, path: String, error: String },
    seconds: Number,
    error: String,
  },
  { timestamps: true },
);
backupLogSchema.index({ createdAt: -1 });

export default mongoose.model('BackupLog', backupLogSchema);
