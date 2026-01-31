import Product from "../../models/Product.model.js";
import ProductVariant from "../../models/ProductVariant.model.js";
import Inventory from "../../models/Inventory.model.js";
import Category from "../../models/Category.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";

export const showProducts = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const [products, totalProducts] = await Promise.all([
    Product.find()
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(),
  ]);

  const productIds = products.map((p) => p._id);

  // Fetch variants for all products
  const variants = await ProductVariant.find({
    product: { $in: productIds },
    isActive: true,
  }).lean();

  const variantMap = {};
  variants.forEach((v) => {
    const key = v.product.toString();
    if (!variantMap[key]) variantMap[key] = [];

    variantMap[key].push(v);
  });

  // Fetch Inventory

  const variantIds = variants.map((v) => v._id);
  const inventories = await Inventory.find({
    variant: { $in: variantIds },
    isActive: true
  }).lean();

  const stockMap = inventories.reduce((acc, item) => {
    const key = item.variant.toString();
    acc[key] = (acc[key] || 0) + item.stock;
    return acc;
  }, {});

  const formattedProducts = products.map((product) => {
    const productVariants = variantMap[product._id.toString()] || [];

    // thumbnail
    const thumbnail = productVariants[0]?.images?.[0]?.url;

    // Total stock
    const totalStock = productVariants.reduce(
      (sum, v) => sum + (stockMap[v._id.toString()] || 0),
      0,
    );

    return {
      ...product,
      thumbnail,
      totalStock,
    };
  });

  res.render("admin/products", {
    layout: "layouts/admin",
    products: formattedProducts,
    currentPage: page,
    totalPage: Math.ceil(totalProducts / limit),
  });
});

// Data for AJAX

export const getProductsAjax = asyncHandler(async (req, res) => {
  const search = req.query.search?.trim() || "";
  const page = parseInt(req.query.page) || 1;
  const limit = 5;
  const skip = (page - 1) * limit;

  const query = {
    name: { $regex: search, $options: "i" },
  };

  const [products, totalProducts] = await Promise.all([
    Product.find(query)
      .populate("category", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Product.countDocuments(query),
  ]);

  const productIds = products.map((p) => p._id);

  const variants = await ProductVariant.find({
    product: { $in: productIds },
    isActive: true,
  }).lean();

  const variantMap = {};
  variants.forEach((v) => {
    const key = v.product.toString();
    if (!variantMap[key]) variantMap[key] = [];
    variantMap[key].push(v);
  });

  const variantIds = variants.map((v) => v._id);
  const inventories = await Inventory.find({
    variant: { $in: variantIds },
    isActive: true
  }).lean();

  const stockMap = inventories.reduce((acc, item) => {
    const key = item.variant.toString();
    acc[key] = (acc[key] || 0) + item.stock;
    return acc;
  }, {});

  const formattedProducts = products.map((product) => {
    const productVariants = variantMap[product._id.toString()] || [];

    const thumbnail = productVariants[0]?.images?.[0]?.url;

    const totalStock = productVariants.reduce(
      (sum, v) => sum + (stockMap[v._id.toString()] || 0),
      0,
    );

    return {
      ...product,
      thumbnail,
      totalStock,
      variantCount: productVariants.length,
    };
  });

  res.status(200).json({
    products: formattedProducts,
    currentPage: page,
    totalPages: Math.ceil(totalProducts / limit),
  });
});

// render add product

export const showAddProduct = asyncHandler(async (req, res) => {
  const categories = await Category.find({ isListed: true, isDeleted: false })
    .sort({ name: 1 })
    .lean();

  res.render("admin/add-product", { layout: false, categories });
});

export const addProduct = asyncHandler(async (req, res) => {
  const {
    name,
    description,
    category,
    gender,
    price,
    offerPercent,
    offerExpiry,
  } = req.body;

  /* ---------------- Basic Validation ---------------- */

  if (!name || !description || !category || !gender) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "All required fields must be provided" });
  }

  const parsedPrice = Number(price);
  if (!parsedPrice || parsedPrice <= 0) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Price must be greater than 0" });
  }

  const allowedGenders = ["Men", "Women", "Unisex"];
  if (!allowedGenders.includes(gender)) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Invalid gender selected" });
  }

  /* ---------------- Category Validation ---------------- */

  const categoryExists = await Category.findOne({
    _id: category,
    isListed: true,
    isDeleted: false,
  });

  if (!categoryExists) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Selected category is not available" });
  }

  /* ---------------- Offer Validation ---------------- */

  const parsedOfferPercent = Number(offerPercent) || 0;

  if (parsedOfferPercent > 0) {
    if (parsedOfferPercent < 1 || parsedOfferPercent > 90) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Offer percent must be between 1 and 90" });
    }

    if (!offerExpiry) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({
          message: "Offer expiry date is required when offer is applied",
        });
    }

    if (new Date(offerExpiry) <= new Date()) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Offer expiry must be a future date" });
    }
  }

  /* ---------------- Duplicate Name Check ---------------- */

  const nameExists = await Product.findOne({
    name: new RegExp(`^${name.trim()}$`, "i"),
  });

  if (nameExists) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Product with this name already exists" });
  }

  /* ---------------- Slug Generation ---------------- */

  const baseSlug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  let slug = baseSlug;
  let counter = 1;

  while (await Product.findOne({ slug })) {
    slug = `${baseSlug}-${counter++}`;
  }

  /* ---------------- Save Product ---------------- */

  const product = new Product({
    name: name.trim(),
    slug,
    description: description.trim(),
    category,
    gender,
    price: parsedPrice,
    offerPercent: parsedOfferPercent || null,
    offerExpiry: parsedOfferPercent ? offerExpiry : null,
  });

  await product.save();

  return res
    .status(HTTP_STATUS.CREATED)
    .json({ message: "Product created successfully.", productId: product._id });
});

export const showEditProduct = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id)
    .populate("category", "name")
    .lean();

  if (!product) {
    req.flash("error", "Product not found");
    return res.redirect("/admin/products");
  }

  const categories = await Category.find({
    isListed: true,
    isDeleted: false,
  })
    .sort({ name: 1 })
    .lean();

  res.render("admin/edit-product", {
    layout: false,
    product,
    categories,
  });
});

export const editProduct = asyncHandler(async (req, res) => {


  const productId = req.params.id;

  const {
    name,
    description,
    category,
    gender,
    price,
    offerPercent,
    offerExpiry,
  } = req.body;


  const product = await Product.findById(productId);

  if (!product) {
    req.flash("error", "Product not Found");
    return res.redirect("/admin/products");
  }

  if (!name || !description || !category || !gender) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Please fill all Required Details" });
  }

  const parsedPrice = Number(price);
  if (!parsedPrice || parsedPrice <= 0) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Price must be greater than 0" });
  }

  const allowedGenders = ["Men", "Women", "Unisex"];
  if (!allowedGenders.includes(gender)) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Invalid gender selected" });
  }

  /* ---------------- Category Validation ---------------- */

  const categoryExists = await Category.findOne({
    _id: category,
    isListed: true,
    isDeleted: false,
  });

  if (!categoryExists) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Invalid category selected" });
  }

  /* ---------------- Name & Slug Update ---------------- */

  if (name.trim() !== product.name) {
    const nameExists = await Product.findOne({
      _id: { $ne: productId },
      name: new RegExp(`^${name.trim()}$`, "i"),
    });

    if (nameExists) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Product name already exists" });
    }

    product.name = name.trim();

    const baseSlug = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    let slug = baseSlug;
    let counter = 1;

    while (await Product.findOne({ slug, _id: { $ne: productId } })) {
      slug = `${baseSlug}-${counter++}`;
    }

    product.slug = slug;
  }

  /* ---------------- Offer Validation ---------------- */

  const parsedOfferPercent = Number(offerPercent) || 0;

  if (parsedOfferPercent > 0) {
    if (parsedOfferPercent < 1 || parsedOfferPercent > 90) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Offer percent must be between 1 and 90" });
    }

    if (!offerExpiry) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Offer expiry date is required" });
    }

    if (new Date(offerExpiry) <= new Date()) {
      return res
        .status(HTTP_STATUS.BAD_REQUEST)
        .json({ message: "Offer expiry must be a future date" });
    }

    product.offerPercent = parsedOfferPercent;
    product.offerExpiry = offerExpiry;
  } else {
    product.offerPercent = null;
    product.offerExpiry = null;
  }

  /* ---------------- Save ---------------- */

  product.description = description.trim();
  product.category = category;
  product.gender = gender;
  product.price = parsedPrice;

  await product.save();

  return res
    .status(HTTP_STATUS.OK)
    .json({ message: "Product updated successfully" });
});

// toggle product status

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const productId = req.params.id;

  const product = await Product.findById(productId);

  if (!product) {
    return res
      .status(HTTP_STATUS.BAD_REQUEST)
      .json({ message: "Product not found" });
  }

  product.isListed = !product.isListed;
  await product.save();

  res
    .status(200)
    .json({
      message: product.isListed ? "Product Listed" : "Product Unlisted",
    });
});






// Full Product Details
export const getProductFullDetails = asyncHandler(async (req, res) => {
  const productId  = req.params.id;


  /* ---------- Product ---------- */
  const product = await Product.findById(productId)
    .populate("category", "name")
    .lean();

  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  //  Variants 
  const variants = await ProductVariant.find({
    product: productId
  })
    .lean();

  if (!variants.length) {
    return res.status(200).json({
      product,
      variants: []
    });
  }

  //  Inventory
  const variantIds = variants.map(v => v._id);

  const inventories = await Inventory.find({
    variant: { $in: variantIds }
  }).lean();

  //   Attach inventory to variants 
  const inventoryMap = {};

  for (const inv of inventories) {
    if (!inventoryMap[inv.variant]) {
      inventoryMap[inv.variant] = [];
    }
    inventoryMap[inv.variant].push({
      size: inv.size,
      stock: inv.stock,
      isActive: inv.isActive
    });
  }

  const formattedVariants = variants.map(variant => ({
    _id: variant._id,
    color: variant.color,
    images: variant.images.map(img => img.url),
    isActive: variant.isActive,
    inventory: inventoryMap[variant._id] || []
  }));

  //   Pricing 
  let finalPrice = product.price;
  if (
    product.offerPercent &&
    product.offerExpiry &&
    new Date(product.offerExpiry) > new Date()
  ) {
    finalPrice =
      product.price -
      (product.price * product.offerPercent) / 100;

  }

  product.finalPrice = finalPrice;


  return res.render("admin/view-product",{
    layout: false,
    product: product,
    variants: formattedVariants
  });
});
