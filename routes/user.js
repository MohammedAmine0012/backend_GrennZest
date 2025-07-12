const express = require('express');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/user/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  }
});

// @route   PUT /api/user/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, [
  body('name')
    .optional()
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Le nom doit contenir entre 2 et 50 caractères'),
  body('phone')
    .optional()
    .trim()
    .isMobilePhone('any')
    .withMessage('Veuillez entrer un numéro de téléphone valide'),
  body('address.street')
    .optional()
    .trim(),
  body('address.city')
    .optional()
    .trim(),
  body('address.postalCode')
    .optional()
    .trim(),
  body('address.country')
    .optional()
    .trim()
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { name, phone, address } = req.body;
    const updateData = {};

    if (name) updateData.name = name;
    if (phone) updateData.phone = phone;
    if (address) updateData.address = address;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      updateData,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès',
      user
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  }
});

// @route   PUT /api/user/impact
// @desc    Update user environmental impact
// @access  Private
router.put('/impact', protect, [
  body('co2Saved')
    .isFloat({ min: 0 })
    .withMessage('CO2 saved must be a positive number'),
  body('waterSaved')
    .isFloat({ min: 0 })
    .withMessage('Water saved must be a positive number'),
  body('orangesRecycled')
    .isInt({ min: 0 })
    .withMessage('Oranges recycled must be a positive integer')
], async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Données invalides',
        errors: errors.array()
      });
    }

    const { co2Saved, waterSaved, orangesRecycled } = req.body;

    // Update user impact using the model method
    const user = await req.user.updateImpact(co2Saved, waterSaved, orangesRecycled);

    res.json({
      success: true,
      message: 'Impact environnemental mis à jour avec succès',
      user: {
        totalCO2Saved: user.totalCO2Saved,
        totalWaterSaved: user.totalWaterSaved,
        totalOrangesRecycled: user.totalOrangesRecycled,
        loyaltyPoints: user.loyaltyPoints,
        tier: user.tier
      }
    });
  } catch (error) {
    console.error('Update impact error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'impact'
    });
  }
});

// @route   GET /api/user/impact
// @desc    Get user environmental impact
// @access  Private
router.get('/impact', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('totalCO2Saved totalWaterSaved totalOrangesRecycled loyaltyPoints tier name');
    
    res.json({
      success: true,
      impact: {
        totalCO2Saved: user.totalCO2Saved,
        totalWaterSaved: user.totalWaterSaved,
        totalOrangesRecycled: user.totalOrangesRecycled,
        loyaltyPoints: user.loyaltyPoints,
        tier: user.tier,
        name: user.name
      }
    });
  } catch (error) {
    console.error('Get impact error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de l\'impact'
    });
  }
});

// @route   GET /api/user/stats
// @desc    Get user statistics and achievements
// @access  Private
router.get('/stats', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    // Calculate achievements
    const achievements = [];
    
    if (user.totalCO2Saved >= 10) {
      achievements.push({
        name: 'Éco-Warrior',
        description: 'A économisé 10kg de CO2',
        icon: '🌱'
      });
    }
    
    if (user.totalWaterSaved >= 50000) {
      achievements.push({
        name: 'Garde-Eau',
        description: 'A économisé 50,000L d\'eau',
        icon: '💧'
      });
    }
    
    if (user.totalOrangesRecycled >= 100) {
      achievements.push({
        name: 'Recycleur Expert',
        description: 'A recyclé 100 écorces d\'oranges',
        icon: '🍊'
      });
    }
    
    if (user.loyaltyPoints >= 500) {
      achievements.push({
        name: 'Membre Fidèle',
        description: 'A atteint 500 points de fidélité',
        icon: '🏆'
      });
    }

    // Calculate next tier progress
    let nextTier = null;
    let progressToNextTier = 0;
    
    if (user.tier === 'bronze') {
      nextTier = 'silver';
      progressToNextTier = (user.loyaltyPoints / 100) * 100;
    } else if (user.tier === 'silver') {
      nextTier = 'gold';
      progressToNextTier = ((user.loyaltyPoints - 100) / 400) * 100;
    } else if (user.tier === 'gold') {
      nextTier = 'platinum';
      progressToNextTier = ((user.loyaltyPoints - 500) / 500) * 100;
    }

    res.json({
      success: true,
      stats: {
        totalCO2Saved: user.totalCO2Saved,
        totalWaterSaved: user.totalWaterSaved,
        totalOrangesRecycled: user.totalOrangesRecycled,
        loyaltyPoints: user.loyaltyPoints,
        tier: user.tier,
        memberSince: user.memberSince,
        achievements,
        nextTier,
        progressToNextTier: Math.min(progressToNextTier, 100)
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

module.exports = router; 