const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
// Add this CORS configuration
const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
};
app.use(cors(corsOptions));


// Add this before your routes
app.use((req, res, next) => {
    console.log(`Incoming ${req.method} request to ${req.path}`);
    next();
});
app.use(bodyParser.json());
app.use('/uploads', express.static('uploads'));

// Database setup
const db = new sqlite3.Database('./waste.db', (err) => {
    if (err) {
        console.error('Database connection error:', err.message);
    } else {
        console.log('Connected to the waste database.');
        initializeDatabase();
    }
});

function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS waste_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        image_path TEXT,
        classification_result TEXT,
        confidence REAL,
        category TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE,
        description TEXT,
        recycling_guidelines TEXT
    )`);
}

// Image upload setup
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
// Update your multer configuration
const upload = multer({
    storage: multer.diskStorage({
        destination: 'uploads/',
        filename: (req, file, cb) => {
            cb(null, `${Date.now()}-${file.originalname}`);
        }
    }),
    fileFilter: (req, file, cb) => {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'), false);
        }
    }
});

// Add error handling middleware
app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: err.message });
    } else if (err) {
        return res.status(500).json({ error: err.message });
    }
    next();
});

// Simulate AI classification (in a real app, you'd integrate with your AI model)
function classifyWaste(imagePath) {
    // This is a mock function - replace with actual AI integration
    const categories = ['plastic', 'paper', 'metal', 'glass', 'organic'];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    return {
        category: randomCategory,
        confidence: (Math.random() * 0.5 + 0.5).toFixed(2), // Random confidence between 0.5 and 1.0
        description: `This appears to be ${randomCategory} waste based on visual analysis.`
    };
}

// Routes
app.get('/favicon.ico', (req, res) => res.status(204));

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Server is running' });
});

// Upload image and classify waste
// Update your classify endpoint
app.post('/api/classify', upload.single('image'), (req, res) => {
    // In your frontend upload function
    console.log('FormData contents:', {
        uri: capturedImage.uri,
        name: filename,
        type: type
    });
    if (!req.file) {
        console.log('No file received');
        return res.status(400).json({ error: 'No image uploaded' });
    }

    console.log('Received file:', req.file); // Log file info
    const imagePath = req.file.path;
    // In your backend classify route
    console.log('File received:', req.file);
    console.log('File path:', req.file?.path);
    console.log('File buffer:', req.file?.buffer);



    if (!fs.existsSync(req.file.path)) {
        console.log('File does not exist at path:', req.file.path);
        return res.status(400).json({ error: 'Uploaded file not found' });
    }

    try {
        const imagePath = req.file.path;
        const classification = classifyWaste(imagePath);

        // Save to database
        db.run(
            'INSERT INTO waste_items (image_path, classification_result, confidence, category) VALUES (?, ?, ?, ?)',
            [imagePath, classification.description, classification.confidence, classification.category],
            function(err) {
                if (err) {
                    console.error('Database error:', err);
                    return res.status(500).json({ error: 'Failed to save classification' });
                }

                res.json({
                    id: this.lastID,
                    imageUrl: `http://localhost:${PORT}/${imagePath.replace(/\\/g, '/')}`,
                    classification,
                    timestamp: new Date().toISOString()
                });
            }
        );
    } catch (err) {
        console.error('Image processing error:', err);
        return res.status(500).json({ error: 'Failed to process image' });
    }
});
// Get all waste items
app.get('/api/waste-items', (req, res) => {
    db.all('SELECT * FROM waste_items ORDER BY timestamp DESC', [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch waste items' });
        }
        res.json(rows);
    });
});

// Get a specific waste item
app.get('/api/waste-items/:id', (req, res) => {
    const id = req.params.id;

    db.get('SELECT * FROM waste_items WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch waste item' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Waste item not found' });
        }

        res.json(row);
    });
});

// Update a waste item (e.g., correct classification)
app.put('/api/waste-items/:id', (req, res) => {
    const id = req.params.id;
    const { category, classification_result } = req.body;

    if (!category || !classification_result) {
        return res.status(400).json({ error: 'Category and classification_result are required' });
    }

    db.run(
        'UPDATE waste_items SET category = ?, classification_result = ? WHERE id = ?',
        [category, classification_result, id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update waste item' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Waste item not found' });
            }

            res.json({ message: 'Waste item updated successfully' });
        }
    );
});

// Delete a waste item
app.delete('/api/waste-items/:id', (req, res) => {
    const id = req.params.id;

    // First get the item to delete the associated image file
    db.get('SELECT image_path FROM waste_items WHERE id = ?', [id], (err, row) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch waste item' });
        }

        if (!row) {
            return res.status(404).json({ error: 'Waste item not found' });
        }

        // Delete the image file if it exists
        if (row.image_path && fs.existsSync(row.image_path)) {
            fs.unlinkSync(row.image_path);
        }

        // Now delete the database record
        db.run('DELETE FROM waste_items WHERE id = ?', [id], function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to delete waste item' });
            }

            res.json({ message: 'Waste item deleted successfully' });
        });
    });
});

// CRUD for waste categories
app.get('/api/categories', (req, res) => {
    db.all('SELECT * FROM categories', [], (err, rows) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to fetch categories' });
        }
        res.json(rows);
    });
});

app.post('/api/categories', (req, res) => {
    const { name, description, recycling_guidelines } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    db.run(
        'INSERT INTO categories (name, description, recycling_guidelines) VALUES (?, ?, ?)',
        [name, description, recycling_guidelines],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to create category' });
            }

            res.status(201).json({
                id: this.lastID,
                name,
                description,
                recycling_guidelines
            });
        }
    );
});

app.put('/api/categories/:id', (req, res) => {
    const id = req.params.id;
    const { name, description, recycling_guidelines } = req.body;

    if (!name) {
        return res.status(400).json({ error: 'Category name is required' });
    }

    db.run(
        'UPDATE categories SET name = ?, description = ?, recycling_guidelines = ? WHERE id = ?',
        [name, description, recycling_guidelines, id],
        function(err) {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Failed to update category' });
            }

            if (this.changes === 0) {
                return res.status(404).json({ error: 'Category not found' });
            }

            res.json({ message: 'Category updated successfully' });
        }
    );
});

app.delete('/api/categories/:id', (req, res) => {
    const id = req.params.id;

    db.run('DELETE FROM categories WHERE id = ?', [id], function(err) {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).json({ error: 'Failed to delete category' });
        }

        if (this.changes === 0) {
            return res.status(404).json({ error: 'Category not found' });
        }

        res.json({ message: 'Category deleted successfully' });
    });
});
app.get('/', (req, res) => {
    res.send(`
    <h1>Smart Waste Sorting System</h1>
    <p>API is running. Use these endpoints:</p>
    <ul>
      <li>GET <a href="/api/health">/api/health</a></li>
      <li>POST /api/classify (upload image)</li>
      <li>GET <a href="/api/waste-items">/api/waste-items</a></li>
    </ul>
  `);
});

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Seed initial categories if they don't exist
function seedInitialCategories() {
    const initialCategories = [
        {
            name: 'plastic',
            description: 'Plastic waste materials',
            recycling_guidelines: 'Rinse containers before recycling. Check local guidelines for which plastics are accepted.'
        },
        {
            name: 'paper',
            description: 'Paper and cardboard waste',
            recycling_guidelines: 'Keep paper dry and clean. Remove any non-paper components like plastic windows from envelopes.'
        },
        {
            name: 'metal',
            description: 'Metal waste including aluminum and steel',
            recycling_guidelines: 'Rinse cans before recycling. Separate aluminum and steel if required by your local facility.'
        },
        {
            name: 'glass',
            description: 'Glass bottles and jars',
            recycling_guidelines: 'Rinse containers and remove lids. Do not recycle broken glass or glassware in curbside bins.'
        },
        {
            name: 'organic',
            description: 'Biodegradable waste like food scraps',
            recycling_guidelines: 'Compost fruit and vegetable scraps, eggshells, and coffee grounds. Avoid meat and dairy in home compost.'
        }
    ];

    initialCategories.forEach(category => {
        db.run(
            'INSERT OR IGNORE INTO categories (name, description, recycling_guidelines) VALUES (?, ?, ?)',
            [category.name, category.description, category.recycling_guidelines],
            (err) => {
                if (err) console.error('Error seeding category:', err);
            }
        );
    });
}

// Call the seed function after a short delay to ensure tables are created
setTimeout(seedInitialCategories, 1000);