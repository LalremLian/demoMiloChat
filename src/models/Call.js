const mongoose = require('mongoose');

const callSchema = new mongoose.Schema(
  {
    callType: {
      type: String,
      enum: ['voice', 'video'],
      required: [true, 'callType is required'],
    },
    status: {
      type: String,
      enum: ['ringing', 'completed', 'missed', 'declined', 'failed'],
      default: 'ringing',
    },
    callerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'callerId is required'],
    },
    calleeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'calleeId is required'],
    },
    // Agora channel name — generated as a UUID on initiation
    channelId: {
      type: String,
      required: [true, 'channelId is required'],
      unique: true,
    },
    // Call duration in seconds — set when call ends
    duration: {
      type: Number,
      default: 0,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.callerId = ret.callerId?.toString();
        ret.calleeId = ret.calleeId?.toString();
        // Populate caller/callee objects already have id from User toJSON
        ret.startedAt = ret.startedAt instanceof Date ? ret.startedAt.getTime() : null;
        ret.endedAt = ret.endedAt instanceof Date ? ret.endedAt.getTime() : null;
        ret.createdAt = ret.createdAt instanceof Date ? ret.createdAt.getTime() : ret.createdAt;
        ret.updatedAt = ret.updatedAt instanceof Date ? ret.updatedAt.getTime() : ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Fast lookups for a user's call history
callSchema.index({ callerId: 1, createdAt: -1 });
callSchema.index({ calleeId: 1, createdAt: -1 });

module.exports = mongoose.model('Call', callSchema);
