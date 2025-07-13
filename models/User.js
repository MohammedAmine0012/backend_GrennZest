const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Environmental impact tracking
  totalCO2Saved: {
    type: Number,
    default: 0
  },
  totalWaterSaved: {
    type: Number,
    default: 0
  },
  totalOrangesRecycled: {
    type: Number,
    default: 0
  },
  // Loyalty system
  loyaltyPoints: {
    type: Number,
    default: 0
  },
  tier: {
    type: String,
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum'],
    default: 'Bronze'
  },
  memberSince: {
    type: Date,
    default: Date.now
  },
  // Profile information
  phone: String,
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: {
      type: String,
      default: 'Morocco'
    }
  },
  // Preferences
  preferences: {
    emailNotifications: {
      type: Boolean,
      default: true
    },
    pushNotifications: {
      type: Boolean,
      default: true
    },
    newsletter: {
      type: Boolean,
      default: true
    }
  },
  // Security
  lastLogin: Date,
  loginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  emailVerificationToken: String,
  emailVerified: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Check if account is locked
userSchema.methods.isLocked = function() {
  return !!(this.lockUntil && this.lockUntil > Date.now());
};

// Increment login attempts
userSchema.methods.incLoginAttempts = function() {
  // If we have a previous lock that has expired, restart at 1
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $unset: { lockUntil: 1 },
      $set: { loginAttempts: 1 }
    });
  }
  
  const updates = { $inc: { loginAttempts: 1 } };
  
  // Lock account after 5 failed attempts
  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 2 * 60 * 60 * 1000 }; // 2 hours
  }
  
  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = function() {
  return this.updateOne({
    $unset: { loginAttempts: 1, lockUntil: 1 }
  });
};

// Update loyalty tier based on points
userSchema.methods.updateTier = function() {
  let newTier = 'Bronze';
  
  if (this.loyaltyPoints >= 1000) {
    newTier = 'Platinum';
  } else if (this.loyaltyPoints >= 500) {
    newTier = 'Gold';
  } else if (this.loyaltyPoints >= 100) {
    newTier = 'Silver';
  }
  
  if (this.tier !== newTier) {
    this.tier = newTier;
    return this.save();
  }
  
  return Promise.resolve(this);
};

// Add environmental impact
userSchema.methods.addEnvironmentalImpact = function(co2Saved, waterSaved, orangesRecycled) {
  this.totalCO2Saved += co2Saved || 0;
  this.totalWaterSaved += waterSaved || 0;
  this.totalOrangesRecycled += orangesRecycled || 0;
  return this.save();
};

// Add loyalty points
userSchema.methods.addLoyaltyPoints = function(points) {
  this.loyaltyPoints += points || 0;
  this.updateTier();
  return this.save();
};

// Check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

module.exports = mongoose.model('User', userSchema); 