const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email format'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never returned by default
    },
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username must not exceed 30 characters'],
      match: [/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'],
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxlength: [50, 'Display name must not exceed 50 characters'],
    },
    bio: {
      type: String,
      default: '',
      maxlength: [160, 'Bio must not exceed 160 characters'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeenAt: {
      type: Date,
      default: null,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    // FCM token for push notifications — never returned in public responses
    fcmToken: {
      type: String,
      default: null,
      select: false,
    },
    blockedUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      default: [],
      select: false,
    },
    // For email verification / password reset flows
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationTokenExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetToken: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    // Stored hashed refresh tokens for multi-device support
    refreshTokens: {
      type: [String],
      default: [],
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        ret.lastSeenAt = ret.lastSeenAt instanceof Date ? ret.lastSeenAt.getTime() : null;
        ret.createdAt = ret.createdAt instanceof Date ? ret.createdAt.getTime() : ret.createdAt;
        ret.updatedAt = ret.updatedAt instanceof Date ? ret.updatedAt.getTime() : ret.updatedAt;
        delete ret._id;
        delete ret.password;
        delete ret.fcmToken;
        delete ret.blockedUsers;
        delete ret.refreshTokens;
        delete ret.verificationToken;
        delete ret.verificationTokenExpiresAt;
        delete ret.passwordResetToken;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Hash password before save
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Instance method — compare plain password against stored hash
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Public profile projection (safe to send to other users)
userSchema.statics.publicFields = 'email username displayName bio avatarUrl isOnline lastSeenAt isVerified createdAt';

module.exports = mongoose.model('User', userSchema);
