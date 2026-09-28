const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['direct', 'group'],
      required: [true, 'Conversation type is required'],
    },
    // Only meaningful for group conversations
    name: {
      type: String,
      trim: true,
      default: null,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    members: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      validate: {
        validator(v) {
          return v.length >= 2;
        },
        message: 'A conversation must have at least 2 members',
      },
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Message',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        // Serialize member IDs as strings
        if (ret.members) {
          ret.members = ret.members.map(m =>
            typeof m === 'object' && m._id ? { ...m, id: m._id.toString(), _id: undefined } : m
          );
        }
        ret.lastMessage = ret.lastMessage
          ? (typeof ret.lastMessage === 'object' && ret.lastMessage._id
              ? { ...ret.lastMessage, id: ret.lastMessage._id.toString(), _id: undefined }
              : ret.lastMessage)
          : null;
        ret.createdAt = ret.createdAt instanceof Date ? ret.createdAt.getTime() : ret.createdAt;
        ret.updatedAt = ret.updatedAt instanceof Date ? ret.updatedAt.getTime() : ret.updatedAt;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Index for fast member lookups
conversationSchema.index({ members: 1 });
// Compound index to quickly find the direct conversation between two users
conversationSchema.index({ type: 1, members: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
