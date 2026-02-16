import mongoose from 'mongoose';

const viewportSchema = new mongoose.Schema({
  name: { type: String, required: true },
  width: { type: Number, required: true },
  height: { type: Number, required: true },
  baseline_image_url: { type: String, default: null },
}, { _id: false });

const monitorSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  target_url: {
    type: String,
    required: true,
  },
  baseline_version: {
    type: Number,
    default: 0,
  },
  viewports: [viewportSchema],
}, { timestamps: true });

const Monitor = mongoose.model('Monitor', monitorSchema);

export default Monitor;
