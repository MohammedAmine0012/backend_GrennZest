const express = require('express');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/users
// @desc    Get all users (for admin purposes)
// @access  Private
router.get('/users', protect, async (req, res) => {
  try {
    // In a real app, you'd check if user is admin
    const users = await User.find({}).select('-password');
    
    res.json({
      success: true,
      count: users.length,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des utilisateurs'
    });
  }
});

// @route   GET /api/admin/stats
// @desc    Get overall statistics
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    
    const totalCO2Saved = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalCO2Saved' } } }
    ]);
    
    const totalWaterSaved = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalWaterSaved' } } }
    ]);
    
    const totalOrangesRecycled = await User.aggregate([
      { $group: { _id: null, total: { $sum: '$totalOrangesRecycled' } } }
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        activeUsers,
        totalCO2Saved: totalCO2Saved[0]?.total || 0,
        totalWaterSaved: totalWaterSaved[0]?.total || 0,
        totalOrangesRecycled: totalOrangesRecycled[0]?.total || 0
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des statistiques'
    });
  }
});

// @route   POST /api/admin/test-notifications
// @desc    Create test notifications for the current user
// @access  Private
router.post('/test-notifications', protect, async (req, res) => {
  try {
    const notifications = [
      {
        type: 'promotion',
        title: 'Promotion spéciale !',
        message: 'Profitez de -20% sur tous nos produits éco-responsables cette semaine.',
        action: { label: 'Voir les offres', url: '/shop' }
      },
      {
        type: 'news',
        title: 'Nouveau produit disponible',
        message: 'Découvrez notre nouveau produit zéro déchet : le kit de démarrage GreenZest.',
        action: { label: 'Découvrir', url: '/shop' }
      },
      {
        type: 'system',
        title: 'Maintenance prévue',
        message: 'Le site sera en maintenance le 15 décembre de 2h à 4h du matin.',
        action: { label: 'En savoir plus', url: '/blog' }
      },
      {
        type: 'order',
        title: 'Commande expédiée !',
        message: 'Votre commande CMD-0001 a été expédiée et arrive bientôt !',
        action: { label: 'Suivre ma commande', url: '/account' }
      }
    ];

    for (const notification of notifications) {
      await Notification.createNotification(
        req.user._id,
        notification.type,
        notification.title,
        notification.message,
        notification.action
      );
    }

    res.json({
      success: true,
      message: 'Notifications de test créées avec succès'
    });
  } catch (error) {
    console.error('Create test notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des notifications de test'
    });
  }
});

// @route   POST /api/admin/test-payment-notification
// @desc    Create a test payment notification
// @access  Private
router.post('/test-payment-notification', protect, async (req, res) => {
  try {
    // Create order confirmation notification
    await Notification.createNotification(
      req.user._id,
      'order',
      'Commande confirmée',
      'Votre commande CMD-0001 a été confirmée. Total: 150 MAD',
      {
        label: 'Voir la commande',
        url: '/account'
      },
      { orderId: 'test-order', orderNumber: 'CMD-0001' }
    );

    // Create loyalty points notification
    await Notification.createNotification(
      req.user._id,
      'promotion',
      'Points de fidélité gagnés !',
      'Vous avez gagné 150 points GreenZest pour votre commande. Continuez vos achats éco-responsables !',
      {
        label: 'Voir mes points',
        url: '/account'
      },
      { pointsEarned: 150, orderNumber: 'CMD-0001' }
    );

    res.json({
      success: true,
      message: 'Notifications de paiement de test créées avec succès'
    });
  } catch (error) {
    console.error('Create test payment notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des notifications de paiement de test'
    });
  }
});

module.exports = router; 