import mongoose from 'mongoose';

const notificationLogSchema = new mongoose.Schema(
  {
    event: { type: String, required: true }, // e.g. order_confirmed
    channel: { type: String, enum: ['email', 'whatsapp', 'sms'], required: true },
    recipient: { type: String, required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
    // logged = no email service connected yet; skipped = switched off in Settings
    status: { type: String, enum: ['queued', 'sent', 'failed', 'logged', 'skipped'], default: 'queued' },
    attempts: { type: Number, default: 0 },
    error: String,
    sentAt: Date,
    messageId: String,
    // Retry of a failed email: the message is kept only until it is sent or given up
    nextAttemptAt: Date,
    payload: { type: { subject: String, text: String, html: String }, select: false },
  },
  { timestamps: true },
);

notificationLogSchema.index({ channel: 1, status: 1, nextAttemptAt: 1 });
notificationLogSchema.index({ createdAt: -1 });

export default mongoose.model('NotificationLog', notificationLogSchema);
