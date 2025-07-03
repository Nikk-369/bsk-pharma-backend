const Product = require("../models/product");
const { logger } = require("../utils/logger");


const multer = require("multer");
const path = require("path");

// Update the multer storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // Use the absolute path to 'uploads' directory
    cb(null, path.join(__dirname, "../uploads/products"));  // absolute path
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});


exports.upload = multer({ storage: storage });

// Create a new product
// const path = require("path");

exports.createProduct = async (req, res) => {
  try {
    const mediaFiles = Object.values(req.files || {}).map(file => ({
      url: `/uploads/products/${file.filename}`,
      type: file.mimetype.startsWith("video") ? "video" : "image",
      name: file.originalname,
      size: file.size
    }));

    const productData = {
      ...req.body,
      media: mediaFiles
    };

    const product = new Product(productData);
    const savedProduct = await product.save();

    logger.info(`Product created: ${savedProduct._id}`);
    res.status(201).json(savedProduct);
  } catch (error) {
    logger.error("Error creating product:", error);
    res.status(400).json({ message: error.message });
  }
};


// Get all products
exports.getAllProducts = async (req, res) => {
  try {
    const products = await Product.find({ deleted_at: null })
      .populate("category")
      .populate("sub_category");

    logger.info(`Fetched ${products.length} products`);
    res.status(200).json(products);
  } catch (error) {
    logger.error("Error fetching all products:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get a single product by ID
exports.getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      deleted_at: null,
    })
      .populate("category")
      .populate("sub_category");

    if (!product) {
      logger.warn(`Product not found with ID: ${req.params.id}`);
      return res.status(404).json({ message: "Product not found" });
    }

    logger.info(`Product retrieved: ${product._id}`);
    res.status(200).json(product);
  } catch (error) {
    logger.error(`Error fetching product by ID (${req.params.id}):`, error);
    res.status(500).json({ message: error.message });
  }
};

// Update a product
exports.updateProduct = async (req, res) => {
  try {
    logger.info(`Request to update product ${req.params.id} with data: ${JSON.stringify(req.body)}`);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!updatedProduct) {
      logger.warn(`Product not found for update: ${req.params.id}`);
      return res.status(404).json({ message: "Product not found" });
    }

    logger.info(`Product updated: ${updatedProduct._id}`);
    res.status(200).json(updatedProduct);
  } catch (error) {
    logger.error(`Error updating product (${req.params.id}):`, error);
    res.status(400).json({ message: error.message });
  }
};


// Soft delete a product
exports.deleteProduct = async (req, res) => {
  try {
    const deletedProduct = await Product.findByIdAndUpdate(
      req.params.id,
      { deleted_at: new Date() },
      { new: true }
    );

    if (!deletedProduct) {
      logger.warn(`Product not found for deletion: ${req.params.id}`);
      return res.status(404).json({ message: "Product not found" });
    }

    logger.info(`Product soft-deleted: ${deletedProduct._id}`);
    res.status(200).json({ message: "Product deleted successfully" });
  } catch (error) {
    logger.error(`Error deleting product (${req.params.id}):`, error);
    res.status(500).json({ message: error.message });
  }
};
// Get all product images
exports.getAllProductImages = async (req, res) => {
  try {
    const products = await Product.find({ deleted_at: null }, 'media');

    const images = products.flatMap(product =>
      product.media.filter(file => file.type === 'image')
    );

    res.status(200).json(images);
  } catch (error) {
    logger.error("Error fetching product images:", error);
    res.status(500).json({ message: error.message });
  }
};

// Get total product count
exports.getProductCount = async (req, res) => {
  try {
    // Count products that are not deleted
    const count = await Product.countDocuments({ deleted_at: null });

    // Get only createdAt field for those products (exclude _id)
    const createdDates = await Product.find({ deleted_at: null }).select({ createdAt: 1, _id: 0 });

    logger.info(`Total product count: ${count}`);

    res.status(200).json({
      total: count,
      createdDates: createdDates,
    });
  } catch (error) {
    logger.error("Error fetching product count:", error);
    res.status(500).json({ message: error.message });
  }
};


// Search products by name and suggest similar products
exports.searchProducts = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === "") {
      return res.status(400).json({ message: "Search query is required" });
    }

    // Search for products where name matches (case-insensitive, partial)
    const matchedProducts = await Product.find({
      name: { $regex: query, $options: "i" },
      deleted_at: null,
    }).populate("category").populate("sub_category");

    // Suggested products (excluding exact matches, showing similar ones)
    const suggestedProducts = await Product.find({
      name: { $regex: query.split(" ")[0], $options: "i" },
      _id: { $nin: matchedProducts.map(p => p._id) },
      deleted_at: null,
    }).limit(5); // Limit suggestions

    logger.info(`Search query: "${query}", Matches: ${matchedProducts.length}, Suggestions: ${suggestedProducts.length}`);

    res.status(200).json({
      results: matchedProducts,
      suggestions: suggestedProducts
    });
  } catch (error) {
    logger.error("Error searching products:", error);
    res.status(500).json({ message: error.message });
  }
};

