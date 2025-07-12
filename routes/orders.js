const express = require('express');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');


const router = express.Router();

// @route   POST /api/orders
// @desc    Create a new order
// @access  Private
router.post('/', protect, [
  body('items').isArray().withMessage('Items must be an array'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.name').notEmpty().withMessage('Product name is required'),
  body('items.*.price').isFloat({ min: 0 }).withMessage('Price must be a positive number'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('total').isFloat({ min: 0 }).withMessage('Total must be a positive number'),
  body('paymentMethod').isIn(['Stripe', 'PayPal', 'Livraison']).withMessage('Invalid payment method'),
  body('shippingAddress.street').optional().trim(),
  body('shippingAddress.city').optional().trim(),
  body('shippingAddress.postalCode').optional().trim(),
  body('shippingAddress.country').optional().trim()
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

    const { items, total, paymentMethod, shippingAddress, deliveryInstructions } = req.body;

    // Create the order
    const order = new Order({
      user: req.user._id,
      items,
      total,
      paymentMethod,
      shippingAddress: shippingAddress || req.user.address,
      deliveryInstructions: deliveryInstructions || ''
    });

    await order.save();

    // Update user's loyalty points based on order total (1 point per MAD)
    const pointsEarned = Math.floor(total);
    await req.user.updateLoyaltyPoints(pointsEarned);

    // Create notification for order confirmation
    try {
      await Notification.createNotification(
        req.user._id,
        'order',
        'Commande confirmée',
        `Votre commande ${order.orderNumber} a été confirmée. Total: ${total} MAD`,
        {
          label: 'Voir la commande',
          url: '/account'
        },
        { orderId: order._id, orderNumber: order.orderNumber }
      );
      console.log('Order confirmation notification created for user:', req.user._id);
    } catch (error) {
      console.error('Error creating order confirmation notification:', error);
    }

    // Create additional notification for loyalty points earned
    if (pointsEarned > 0) {
      try {
        await Notification.createNotification(
          req.user._id,
          'promotion',
          'Points de fidélité gagnés !',
          `Vous avez gagné ${pointsEarned} points GreenZest pour votre commande. Continuez vos achats éco-responsables !`,
          {
            label: 'Voir mes points',
            url: '/account'
          },
          { pointsEarned, orderNumber: order.orderNumber }
        );
        console.log('Loyalty points notification created for user:', req.user._id);
      } catch (error) {
        console.error('Error creating loyalty points notification:', error);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Commande créée avec succès',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        items: order.items,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la commande'
    });
  }
});

// @route   GET /api/orders
// @desc    Get user's orders
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .select('orderNumber total status items createdAt');

    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        items: order.items.map(item => ({
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        date: order.createdAt
      }))
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
});

// @route   GET /api/orders/:id
// @desc    Get specific order details
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ 
      _id: req.params.id, 
      user: req.user._id 
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    res.json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        items: order.items,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des détails de la commande'
    });
  }
});

// Cancel order
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    if (order.status === 'Annulée' || order.status === 'Livrée') {
      return res.status(400).json({ success: false, message: 'Commande déjà annulée ou livrée' });
    }
    order.status = 'Annulée';
    await order.save();

    // Create notification for order cancellation
    await Notification.createNotification(
      req.user._id,
      'order',
      'Commande annulée',
      `Votre commande ${order.orderNumber} a été annulée avec succès.`,
      {
        label: 'Voir les commandes',
        url: '/account'
      },
      { orderId: order._id, orderNumber: order.orderNumber }
    );

    res.json({ success: true, order });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de l\'annulation de la commande' });
  }
});

// Get order data for invoice generation
router.get('/:id/invoice', protect, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).populate('user');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }
    
    res.json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        items: order.items,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        user: {
          name: order.user.name,
          email: order.user.email
        }
      }
    });
  } catch (error) {
    console.error('Get order for invoice error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des données de la facture' });
  }
});

// Get all orders for bulk invoice download
router.get('/all/invoices', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).populate('user').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      orders: orders.map(order => ({
        id: order._id,
        orderNumber: order.orderNumber,
        total: order.total,
        status: order.status,
        items: order.items,
        paymentMethod: order.paymentMethod,
        shippingAddress: order.shippingAddress,
        createdAt: order.createdAt,
        user: {
          name: order.user.name,
          email: order.user.email
        }
      }))
    });
  } catch (error) {
    console.error('Get all orders for invoices error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des commandes' });
  }
});

// Update order status (for admin or system use)
router.put('/:id/status', protect, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
    
    if (!order) {
      return res.status(404).json({ success: false, message: 'Commande non trouvée' });
    }

    const oldStatus = order.status;
    order.status = status;
    await order.save();

    // Create notification for status change
    let notificationTitle = '';
    let notificationMessage = '';

    switch (status) {
      case 'En préparation':
        notificationTitle = 'Commande en préparation';
        notificationMessage = `Votre commande ${order.orderNumber} est maintenant en cours de préparation.`;
        break;
      case 'Expédiée':
        notificationTitle = 'Commande expédiée !';
        notificationMessage = `Votre commande ${order.orderNumber} a été expédiée et arrive bientôt !`;
        break;
      case 'Livrée':
        notificationTitle = 'Commande livrée !';
        notificationMessage = `Votre commande ${order.orderNumber} a été livrée. Merci pour votre confiance !`;
        break;
      default:
        notificationTitle = 'Statut de commande mis à jour';
        notificationMessage = `Le statut de votre commande ${order.orderNumber} a été mis à jour : ${status}`;
    }

    await Notification.createNotification(
      req.user._id,
      'order',
      notificationTitle,
      notificationMessage,
      {
        label: 'Suivre ma commande',
        url: '/account'
      },
      { orderId: order._id, orderNumber: order.orderNumber, status }
    );

    res.json({ success: true, order });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ success: false, message: 'Erreur lors de la mise à jour du statut' });
  }
});

module.exports = router; 