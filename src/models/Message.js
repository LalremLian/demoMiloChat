const mongoose = require('mongoose');

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    count: { type: Number, default: 1 },
  },
  { _id: false }
);

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    mimeType: { type: String, default: '' },
    fileName: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: '' },
    duration: { type: Number, default: 0 }, // seconds, for audio/video
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: [true, 'conversationId is required'],
      index: true,
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'senderId is required'],
    },
    type: {
      type: String,
      enum: ['text', 'image', 'video', 'file', 'voice', 'system'],
      default: 'text',
    },
    text: {
      type: String,
      default: '',
      maxlength: [4000, 'Message text must not exceed 4000 characters'],
    },
    attachment: {
      type: attachmentSchema,
      default: null,
    },
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['sent', 'delivered', 'read', 'deleted'],
      default: 'sent',
    },
    isEdited: {
      type: Boolean,
      default: false,
    },
    // Client-generated UUID for deduplication — unique per conversation
    localId: {
      type: String,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.conversationId = ret.conversationId?.toString();
        ret.senderId = ret.senderId?.toString();
        ret.replyToId = ret.replyTo?.toString() || null;
        ret.replyTo = undefined;
        if (ret.reactions) {
          ret.reactions = ret.reactions.map(r => ({
            ...r,
            userId: r.userId?.toString(),
          }));
        }
        ret.createdAt = ret.createdAt instanceof Date ? ret.createdAt.getTime() : ret.createdAt;
        ret.updatedAt = ret.updatedAt instanceof Date ? ret.updatedAt.getTime() : ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Cursor-based pagination: fetch messages before a given _id
messageSchema.index({ conversationId: 1, _id: -1 });

module.exports = mongoose.model('Message', messageSchema);
