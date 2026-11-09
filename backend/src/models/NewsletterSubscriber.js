import mongoose from 'mongoose';

// Newsletter / WhatsApp updates sign-ups (PRD §13.1). Consent is recorded with
// the policy version; unsubscribing keeps only the fact that they left.
const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, lowercase: true, trim: true },
    mobile: String,
    status: { type: String, enum: ['subscribed', 'unsubscribed'], default: 'subscribed' },
    consent: { acceptedAt: Date, policyVersion: String },
    source: { type: String, default: 'homepage' },
    unsubscribedAt: Date,
  },
  { timestamps: true },
);

newsletterSubscriberSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: 'string' } } });
newsletterSubscriberSchema.index({ mobile: 1 }, { unique: true, partialFilterExpression: { mobile: { $type: 'string' } } });
newsletterSubscriberSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model('NewsletterSubscriber', newsletterSubscriberSchema);
