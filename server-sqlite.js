const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const sqlite3 = require('sqlite3').verbose();
require('dotenv').config({ path: './config.env' });

const app = express();

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' 
    : 'http://localhost:5173',
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Initialize SQLite database
const db = new sqlite3.Database('./greenzest.db');

// Create tables
db.serialize(() => {
  // Users table
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    phone TEXT,
    address_street TEXT,
    address_city TEXT,
    address_postalCode TEXT,
    address_country TEXT,
    totalCO2Saved REAL DEFAULT 0,
    totalWaterSaved REAL DEFAULT 0,
    totalOrangesRecycled INTEGER DEFAULT 0,
    loyaltyPoints INTEGER DEFAULT 0,
    tier TEXT DEFAULT 'bronze',
    memberSince DATETIME DEFAULT CURRENT_TIMESTAMP,
    isActive BOOLEAN DEFAULT 1,
    lastLogin DATETIME DEFAULT CURRENT_TIMESTAMP,
    createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// Helper function to create JWT token
const createToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'fallback-secret', {
    expiresIn: '30d'
  });
};

// Auth routes
app.post('/api/auth/signup', [
  body('name').trim().isLength({ min: 2, max: 50 }),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }

  const { name, email, password } = req.body;

  // Check if user exists
  db.get('SELECT id FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de base de données'
      });
    }

    if (row) {
      return res.status(400).json({
        success: false,
        message: 'Un compte avec cet email existe déjà'
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    db.run(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword],
      function(err) {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la création du compte'
          });
        }

        // Get the created user
        db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
          if (err) {
            return res.status(500).json({
              success: false,
              message: 'Erreur lors de la récupération de l\'utilisateur'
            });
          }

          const token = createToken(user.id);
          delete user.password;

          res.status(201).json({
            success: true,
            token,
            user
          });
        });
      }
    );
  });
});

app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Données invalides',
      errors: errors.array()
    });
  }

  const { email, password } = req.body;

  db.get('SELECT * FROM users WHERE email = ?', [email], async (err, user) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Erreur de base de données'
      });
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Votre compte a été désactivé'
      });
    }

    // Update last login
    db.run('UPDATE users SET lastLogin = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);

    const token = createToken(user.id);
    delete user.password;

    res.json({
      success: true,
      token,
      user
    });
  });
});

app.get('/api/auth/verify', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    db.get('SELECT * FROM users WHERE id = ? AND isActive = 1', [decoded.id], (err, user) => {
      if (err || !user) {
        return res.status(401).json({
          success: false,
          message: 'Token invalide'
        });
      }

      delete user.password;
      res.json({
        success: true,
        user
      });
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Déconnexion réussie'
  });
});

// User routes
app.put('/api/user/impact', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    const { co2Saved, waterSaved, orangesRecycled } = req.body;

    db.run(
      `UPDATE users 
       SET totalCO2Saved = totalCO2Saved + ?, 
           totalWaterSaved = totalWaterSaved + ?, 
           totalOrangesRecycled = totalOrangesRecycled + ?,
           loyaltyPoints = loyaltyPoints + ?,
           updatedAt = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [co2Saved, waterSaved, orangesRecycled, Math.floor(co2Saved), decoded.id],
      function(err) {
        if (err) {
          return res.status(500).json({
            success: false,
            message: 'Erreur lors de la mise à jour'
          });
        }

        // Get updated user data
        db.get(
          'SELECT totalCO2Saved, totalWaterSaved, totalOrangesRecycled, loyaltyPoints, tier FROM users WHERE id = ?',
          [decoded.id],
          (err, user) => {
            if (err) {
              return res.status(500).json({
                success: false,
                message: 'Erreur lors de la récupération des données'
              });
            }

            res.json({
              success: true,
              message: 'Impact environnemental mis à jour avec succès',
              user
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Token invalide'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'GreenZest API is running (SQLite)' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} (SQLite)`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
    } else {
      console.log('Database connection closed.');
    }
    process.exit(0);
  });
}); 