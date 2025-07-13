const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  originalPrice: {
    type: Number,
    min: 0
  },
  category: {
    type: String,
    required: true,
    enum: ['cosmetics', 'cleaning', 'kitchen', 'bathroom', 'accessories', 'gifts']
  },
  subcategory: {
    type: String,
    trim: true
  },
  images: [{
    type: String,
    required: true
  }],
  image: {
    type: String,
    required: true
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  sku: {
    type: String,
    unique: true,
    sparse: true
  },
  weight: {
    type: Number,
    min: 0
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isOnSale: {
    type: Boolean,
    default: false
  },
  salePercentage: {
    type: Number,
    min: 0,
    max: 100
  },
  tags: [String],
  ecoImpact: {
    co2Saved: {
      type: Number,
      default: 0
    },
    waterSaved: {
      type: Number,
      default: 0
    },
    plasticSaved: {
      type: Number,
      default: 0
    }
  },
  ingredients: [String],
  instructions: String,
  warnings: String,
  certifications: [String],
  reviews: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  soldCount: {
    type: Number,
    default: 0
  },
  viewCount: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Generate SKU before saving
productSchema.pre('save', async function(next) {
  if (this.isNew && !this.sku) {
    const count = await mongoose.model('Product').countDocuments();
    this.sku = `GZ-${this.category.toUpperCase().substring(0, 3)}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// Calculate average rating when reviews change
productSchema.pre('save', function(next) {
  if (this.reviews && this.reviews.length > 0) {
    const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
    this.averageRating = totalRating / this.reviews.length;
    this.reviewCount = this.reviews.length;
  }
  next();
});

// Calculate sale price
productSchema.virtual('salePrice').get(function() {
  if (this.isOnSale && this.salePercentage) {
    return this.price - (this.price * this.salePercentage / 100);
  }
  return this.price;
});

// Get main image
productSchema.virtual('mainImage').get(function() {
  return this.image || (this.images && this.images[0]) || '';
});

// Check if product is in stock
productSchema.virtual('inStock').get(function() {
  return this.stock > 0;
});

// Check if product is low in stock
productSchema.virtual('lowStock').get(function() {
  return this.stock > 0 && this.stock <= 5;
});

// Index for search
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

// Static method to get featured products
productSchema.statics.getFeatured = function() {
  return this.find({ isFeatured: true, isActive: true }).limit(8);
};

// Static method to get products on sale
productSchema.statics.getOnSale = function() {
  return this.find({ isOnSale: true, isActive: true }).limit(8);
};

// Static method to get products by category
productSchema.statics.getByCategory = function(category) {
  return this.find({ category, isActive: true });
};

// Static method to search products
productSchema.statics.search = function(query) {
  return this.find({
    $text: { $search: query },
    isActive: true
  }).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Product', productSchema); 