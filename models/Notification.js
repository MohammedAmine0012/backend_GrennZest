const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['order', 'promotion', 'news', 'system'],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 100
  },
  message: {
    type: String,
    required: true,
    maxlength: 500
  },
  read: {
    type: Boolean,
    default: false
  },
  action: {
    label: String,
    url: String
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

// Index for better query performance
notificationSchema.index({ user: 1, read: 1 });
notificationSchema.index({ user: 1, createdAt: -1 });

// Static method to create notification
notificationSchema.statics.createNotification = async function(userId, type, title, message, action = null, data = {}) {
  const notification = new this({
    user: userId,
    type,
    title,
    message,
    action,
    data
  });
  
  return await notification.save();
};

// Instance method to mark as read
notificationSchema.methods.markAsRead = async function() {
  this.read = true;
  return await this.save();
};

module.exports = mongoose.model('Notification', notificationSchema); 