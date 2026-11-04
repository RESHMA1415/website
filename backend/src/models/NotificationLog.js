import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // e.g. order_confirmed
    channel: { type: String, enum: ['email', 'whatsapp'], required: true },
    recipient: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    status: { type: String, enum: ['queued', 'sent', 'failed'], default: 'queued' },
    attempts: { type: Number, default: 0 },
    error: String,
  },
  { timestamps: true },
);

export default mongoose.model('NotificationLog', notificationLogSchema);
