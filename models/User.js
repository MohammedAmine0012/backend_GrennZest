const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom est requis'],
    trim: true,
    maxlength: [50, 'Le nom ne peut pas dépasser 50 caractères']
  },
  email: {
    type: String,
    required: [true, 'L\'email est requis'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Veuillez entrer un email valide']
  },
  password: {
    type: String,
    required: [true, 'Le mot de passe est requis'],
    minlength: [6, 'Le mot de passe doit contenir au moins 6 caractères'],
    select: false // Don't include password in queries by default
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    street: String,
    city: String,
    postalCode: String,
    country: String
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
    enum: ['bronze', 'silver', 'gold', 'platinum'],
    default: 'bronze'
  },
  // Account info
  memberSince: {
    type: Date,
    default: Date.now
  },
  preferences: [{
    type: String
  }],
  // Orders will be stored in a separate collection
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  // Security fields
  failedLoginAttempts: {
    type: Number,
    default: 0
  },
  lockUntil: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

// Index for better query performance
userSchema.index({ email: 1 });
userSchema.index({ loyaltyPoints: -1 });

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();

  try {
    // Hash password with cost of 12
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if entered password is correct
userSchema.methods.correctPassword = async function(candidatePassword, userPassword) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

// Method to update environmental impact
userSchema.methods.updateImpact = function(co2Saved, waterSaved, orangesRecycled) {
  this.totalCO2Saved += co2Saved;
  this.totalWaterSaved += waterSaved;
  this.totalOrangesRecycled += orangesRecycled;
  
  // Update loyalty points (1 point per kg of CO2 saved)
  this.loyaltyPoints += Math.floor(co2Saved);
  
  // Update tier based on loyalty points
  if (this.loyaltyPoints >= 1000) {
    this.tier = 'platinum';
  } else if (this.loyaltyPoints >= 500) {
    this.tier = 'gold';
  } else if (this.loyaltyPoints >= 100) {
    this.tier = 'silver';
  }
  
  return this.save();
};

// Method to update loyalty points
userSchema.methods.updateLoyaltyPoints = function(points) {
  this.loyaltyPoints += points;
  
  // Update tier based on loyalty points
  if (this.loyaltyPoints >= 1000) {
    this.tier = 'platinum';
  } else if (this.loyaltyPoints >= 500) {
    this.tier = 'gold';
  } else if (this.loyaltyPoints >= 100) {
    this.tier = 'silver';
  }
  
  return this.save();
};

// Virtual for formatted member since date
userSchema.virtual('memberSinceFormatted').get(function() {
  return this.memberSince.toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long'
  });
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('User', userSchema); 