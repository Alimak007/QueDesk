import mongoose from 'mongoose';

/**
 * Small binary assets (company logos and signatures) stored in MongoDB.
 * Keeping them in the database avoids ephemeral-disk problems on hosting
 * platforms and keeps access control in one place.
 */
const assetSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ['logo', 'signature'], required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    originalName: { type: String, default: '' },
    data: { type: Buffer, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Asset = mongoose.model('Asset', assetSchema);
