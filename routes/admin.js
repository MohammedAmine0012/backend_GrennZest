const express = require('express');
const User = require('../models/User');
const Order = require('../models/Order');
const Product = require('../models/Product');
const Comment = require('../models/Comment');
const Notification = require('../models/Notification');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/admin/users
// @desc    Get all users (for admin purposes)
// @access  Private/Admin
router.get('/users', protect, admin, async (req, res) => {
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

// @route   GET /api/admin/orders
// @desc    Get all orders (for admin purposes)
// @access  Private/Admin
router.get('/orders', protect, admin, async (req, res) => {
  try {
    const orders = await Order.find({})
      .populate('user', 'name email')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commandes'
    });
  }
});

// @route   PUT /api/admin/orders/:id/status
// @desc    Update order status
// @access  Private/Admin
router.put('/orders/:id/status', protect, admin, async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate('user', 'name email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Commande non trouvée'
      });
    }

    // Create notification for user
    const statusMessages = {
      'processing': 'Votre commande est en cours de traitement',
      'shipped': 'Votre commande a été expédiée',
      'delivered': 'Votre commande a été livrée',
      'cancelled': 'Votre commande a été annulée'
    };

    if (statusMessages[status]) {
      await Notification.create({
        user: order.user._id,
        title: 'Mise à jour de commande',
        message: statusMessages[status],
        type: 'order_update',
        data: { orderId: order._id, status }
      });
    }

    res.json({
      success: true,
      order
    });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du statut'
    });
  }
});

// @route   GET /api/admin/products
// @desc    Get all products (for admin purposes)
// @access  Private/Admin
router.get('/products', protect, admin, async (req, res) => {
  try {
    const products = await Product.find({}).sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: products.length,
      products
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des produits'
    });
  }
});

// @route   POST /api/admin/products
// @desc    Create new product
// @access  Private/Admin
router.post('/products', protect, admin, async (req, res) => {
  try {
    const product = await Product.create(req.body);
    
    res.status(201).json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du produit'
    });
  }
});

// @route   PUT /api/admin/products/:id
// @desc    Update product
// @access  Private/Admin
router.put('/products/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.json({
      success: true,
      product
    });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du produit'
    });
  }
});

// @route   DELETE /api/admin/products/:id
// @desc    Delete product
// @access  Private/Admin
router.delete('/products/:id', protect, admin, async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Produit non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Produit supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du produit'
    });
  }
});

// @route   GET /api/admin/stats
// @desc    Get comprehensive admin statistics
// @access  Private/Admin
router.get('/stats', protect, admin, async (req, res) => {
  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch all data
    const [users, orders, products] = await Promise.all([
      User.find({}),
      Order.find({}),
      Product.find({})
    ]);

    // Calculate statistics
    const totalUsers = users.length;
    const activeUsers = users.filter(user => user.isActive).length;
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    
    const todayOrders = orders.filter(order => 
      order.createdAt >= today && order.createdAt < tomorrow
    ).length;
    
    const todayRevenue = orders.filter(order => 
      order.createdAt >= today && order.createdAt < tomorrow
    ).reduce((sum, order) => sum + order.total, 0);
    
    const pendingOrders = orders.filter(order => 
      ['pending', 'processing'].includes(order.status)
    ).length;

    // Environmental impact
    const totalCO2Saved = users.reduce((sum, user) => sum + (user.totalCO2Saved || 0), 0);
    const totalWaterSaved = users.reduce((sum, user) => sum + (user.totalWaterSaved || 0), 0);
    const totalOrangesRecycled = users.reduce((sum, user) => sum + (user.totalOrangesRecycled || 0), 0);

    const stats = {
      totalUsers,
      activeUsers,
      totalOrders,
      totalRevenue,
      todayOrders,
      todayRevenue,
      pendingOrders,
      totalCO2Saved,
      totalWaterSaved,
      totalOrangesRecycled
    };

    res.json({
      success: true,
      stats
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
// @desc    Create test notifications
// @access  Private/Admin
router.post('/test-notifications', protect, admin, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).limit(5);
    
    const testNotifications = users.map(user => ({
      user: user._id,
      title: 'Notification de test',
      message: 'Ceci est une notification de test pour vérifier le système.',
      type: 'test',
      data: { test: true }
    }));

    await Notification.insertMany(testNotifications);

    res.json({
      success: true,
      message: `${testNotifications.length} notifications de test créées`
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
// @desc    Create test payment notification
// @access  Private/Admin
router.post('/test-payment-notification', protect, admin, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).limit(3);
    
    const paymentNotifications = users.map(user => ({
      user: user._id,
      title: 'Paiement reçu',
      message: 'Votre paiement de 150 MAD a été reçu avec succès.',
      type: 'payment',
      data: { amount: 150, currency: 'MAD' }
    }));

    await Notification.insertMany(paymentNotifications);

    res.json({
      success: true,
      message: `${paymentNotifications.length} notifications de paiement créées`
    });
  } catch (error) {
    console.error('Create payment notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création des notifications de paiement'
    });
  }
});

// ADMIN MANAGEMENT
// @route   GET /api/admin/admins
// @desc    Get all admin users
// @access  Private/Admin
router.get('/admins', protect, admin, async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' }).select('-password');
    res.json({ success: true, admins });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la récupération des admins' });
  }
});

// @route   POST /api/admin/admins
// @desc    Add a new admin
// @access  Private/Admin
router.post('/admins', protect, admin, async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Tous les champs sont requis' });
    }
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Cet email existe déjà' });
    }
    const newAdmin = await User.create({ name, email, password, role: 'admin' });
    res.status(201).json({ success: true, admin: { _id: newAdmin._id, name: newAdmin.name, email: newAdmin.email, role: newAdmin.role } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la création de l\'admin' });
  }
});

// @route   PUT /api/admin/admins/:id/demote
// @desc    Demote an admin to user (cannot demote self)
// @access  Private/Admin
router.put('/admins/:id/demote', protect, admin, async (req, res) => {
  try {
    if (req.user._id.toString() === req.params.id) {
      return res.status(400).json({ success: false, message: 'Vous ne pouvez pas vous retirer vous-même' });
    }
    const adminUser = await User.findById(req.params.id);
    if (!adminUser || adminUser.role !== 'admin') {
      return res.status(404).json({ success: false, message: 'Admin non trouvé' });
    }
    adminUser.role = 'user';
    await adminUser.save();
    res.json({ success: true, message: 'Admin rétrogradé avec succès' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Erreur lors de la rétrogradation de l\'admin' });
  }
});

// COMMENT MANAGEMENT
// @route   GET /api/admin/comments
// @desc    Get all comments
// @access  Private/Admin
router.get('/comments', protect, admin, async (req, res) => {
  try {
    const comments = await Comment.find({})
      .populate('user', 'name email')
      .populate('product', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      count: comments.length,
      comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des commentaires'
    });
  }
});

// @route   DELETE /api/admin/comments/:id
// @desc    Delete a comment
// @access  Private/Admin
router.delete('/comments/:id', protect, admin, async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    
    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Commentaire supprimé avec succès'
    });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du commentaire'
    });
  }
});

// @route   PUT /api/admin/comments/:id/approve
// @desc    Approve/unapprove a comment
// @access  Private/Admin
router.put('/comments/:id/approve', protect, admin, async (req, res) => {
  try {
    const { isApproved } = req.body;
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { isApproved },
      { new: true }
    );

    if (!comment) {
      return res.status(404).json({
        success: false,
        message: 'Commentaire non trouvé'
      });
    }

    res.json({
      success: true,
      message: `Commentaire ${isApproved ? 'approuvé' : 'désapprouvé'} avec succès`,
      comment
    });
  } catch (error) {
    console.error('Update comment error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du commentaire'
    });
  }
});

// @route   GET /api/admin/analytics
// @desc    Get detailed analytics data
// @access  Private/Admin
router.get('/analytics', protect, admin, async (req, res) => {
  try {
    // Get date ranges for analytics
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    // Fetch all data
    const [users, orders, products] = await Promise.all([
      User.find({}),
      Order.find({}),
      Product.find({})
    ]);

    // Calculate analytics
    const analytics = {
      // Stock analytics
      stockAnalytics: {
        totalProducts: products.length,
        activeProducts: products.filter(p => p.isActive).length,
        lowStockProducts: products.filter(p => p.stock <= 5).length,
        outOfStockProducts: products.filter(p => p.stock === 0).length,
        totalStockValue: products.reduce((sum, p) => sum + (p.price * p.stock), 0),
        averageStock: products.reduce((sum, p) => sum + p.stock, 0) / products.length || 0
      },

      // Sales analytics
      salesAnalytics: {
        totalOrders: orders.length,
        totalRevenue: orders.reduce((sum, order) => sum + order.total, 0),
        averageOrderValue: orders.length > 0 ? orders.reduce((sum, order) => sum + order.total, 0) / orders.length : 0,
        todayOrders: orders.filter(order => order.createdAt >= today).length,
        todayRevenue: orders.filter(order => order.createdAt >= today).reduce((sum, order) => sum + order.total, 0),
        thisWeekOrders: orders.filter(order => order.createdAt >= thisWeek).length,
        thisWeekRevenue: orders.filter(order => order.createdAt >= thisWeek).reduce((sum, order) => sum + order.total, 0),
        thisMonthOrders: orders.filter(order => order.createdAt >= thisMonth).length,
        thisMonthRevenue: orders.filter(order => order.createdAt >= thisMonth).reduce((sum, order) => sum + order.total, 0)
      },

      // User analytics
      userAnalytics: {
        totalUsers: users.length,
        activeUsers: users.filter(user => user.isActive).length,
        newUsersThisMonth: users.filter(user => user.createdAt >= thisMonth).length,
        newUsersLastMonth: users.filter(user => user.createdAt >= lastMonth && user.createdAt < thisMonth).length
      },

      // Product category analytics
      categoryAnalytics: {
        cosmetics: products.filter(p => p.category === 'cosmetics').length,
        cleaning: products.filter(p => p.category === 'cleaning').length,
        kitchen: products.filter(p => p.category === 'kitchen').length,
        bathroom: products.filter(p => p.category === 'bathroom').length,
        accessories: products.filter(p => p.category === 'accessories').length,
        gifts: products.filter(p => p.category === 'gifts').length
      },

      // Top products by stock
      topProductsByStock: products
        .sort((a, b) => b.stock - a.stock)
        .slice(0, 10)
        .map(p => ({
          id: p._id,
          name: p.name,
          stock: p.stock,
          price: p.price,
          image: p.image
        })),

      // Low stock alerts
      lowStockAlerts: products
        .filter(p => p.stock <= 5)
        .map(p => ({
          id: p._id,
          name: p.name,
          stock: p.stock,
          price: p.price,
          image: p.image
        })),

      // Environmental impact
      environmentalImpact: {
        totalCO2Saved: users.reduce((sum, user) => sum + (user.totalCO2Saved || 0), 0),
        totalWaterSaved: users.reduce((sum, user) => sum + (user.totalWaterSaved || 0), 0),
        totalOrangesRecycled: users.reduce((sum, user) => sum + (user.totalOrangesRecycled || 0), 0)
      }
    };

    res.json({
      success: true,
      analytics
    });
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des analytics'
    });
  }
});

// TEMP: Add initial three products (for setup only)
router.post('/add-initial-products', protect, admin, async (req, res) => {
  try {
    const initialProducts = [
      {
        name: "Pâte Nettoyante GreenZest",
        description: "Pâte nettoyante 100% naturelle à base d'écorces d'oranges amères. Efficace sur toutes les surfaces.",
        price: 45,
        category: "cleaning",
        stock: 150,
        image: "/img1.jpg",
        isActive: true,
        impact: "Chaque pot recycle 20 écorces et économise 10 000L d'eau"
      },
      {
        name: "Confiture d'Orange Amère",
        description: "Confiture artisanale préparée avec des écorces d'oranges amères récupérées. Goût authentique et naturel.",
        price: 15,
        category: "gifts",
        stock: 80,
        image: "/img2.jpg",
        isActive: true,
        impact: "Transforme les déchets d'agrumes en délicieux produit artisanal"
      },
      {
        name: "Sirop d'Orange Amère",
        description: "Sirop concentré d'orange amère, parfait pour vos boissons et desserts. 100% naturel et sans additifs.",
        price: 35,
        category: "gifts",
        stock: 100,
        image: "/img3.jpg",
        isActive: true,
        impact: "Valorise les écorces d'agrumes en produit gourmand"
      }
    ];
    const created = await Promise.all(initialProducts.map(p => Product.create(p)));
    res.json({ success: true, products: created });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router; 