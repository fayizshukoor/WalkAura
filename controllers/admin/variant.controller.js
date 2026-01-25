import Product from "../../models/Product.model.js";
import ProductVariant from "../../models/ProductVariant.model.js";
import Inventory from "../../models/Inventory.model.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../../utils/cloudinaryUpload.util.js";
import { generateSKU } from "../../utils/skuGenerator.util.js";
import asyncHandler from "../../utils/asyncHandler.js";
import {HTTP_STATUS} from "../../constants/httpStatus.js";




export const showManageVariants = asyncHandler(async (req, res) => {
  const productId = req.params.productId;

  const product = await Product.findById(productId).lean();
  if (!product) {
    return res.redirect("/admin/products");
  }

  // Fetch variants
  const variants = await ProductVariant.find({ product: productId })
    .sort({ createdAt: -1 })
    .lean();

  //  Fetch inventory
  const variantIds = variants.map(v => v._id);

  const inventories = await Inventory.find({
    variant: { $in: variantIds }
  }).lean();

  //  Group inventory by variantId
  const inventoryMap = {};
  inventories.forEach(inv => {
    const key = inv.variant.toString();
    if (!inventoryMap[key]) inventoryMap[key] = [];
    inventoryMap[key].push({
      size: inv.size,
      stock: inv.stock,
      isActive : inv.isActive
    });
  });

  //  Normalize data for UI
  const formattedVariants = variants.map(v => ({
    _id: v._id,
    color: v.color,
    isActive: v.isActive,

    //  extract image URLs
    images: v.images.map(img => img.url),

    // attach inventory
    inventory: inventoryMap[v._id.toString()] || []
  }));

  product.variants = formattedVariants;


  res.render("admin/manage-variants", {
    layout: false,
    product
  });
});






export const addVariant = asyncHandler(async (req, res) => {
  const { productId } = req.params;
  const { color, sizes } = req.body;

  let variant = null;
  let uploadedImages = [];

  if (!productId || !color || !sizes) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product, color, and sizes are required" });
  }

  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({ message: "Product not found" });
  }

  const colorExists = await ProductVariant.findOne({
    product: productId,
    color: new RegExp(`^${color.trim()}$`, "i")
  });

  if (colorExists) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "This color already exists" });
  }

  if (!req.files || req.files.length < 3 || req.files.length > 4) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "3 to 4 images required" });
  }

  let parsedSizes;
  try {
    parsedSizes = JSON.parse(sizes);
  } catch {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid sizes format" });
  }

  const sizeSet = new Set();
  let totalStock = 0;

  if(parsedSizes.length === 0){
    return res.status(HTTP_STATUS.BAD_REQUEST).json({message : "Atleast One size is needed"});
  }

  for (const s of parsedSizes) {
    if (!Number.isInteger(s.size) || s.size <= 0 || s.stock < 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid size or stock" });
    }
    if (sizeSet.has(s.size)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: `Duplicate size ${s.size}` });
    }
    sizeSet.add(s.size);
    totalStock += s.stock;
  }

  if (totalStock === 0) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Atleast one size should have stock" });
  }

  try {
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id
      });
    }

    variant = await ProductVariant.create({
      product: productId,
      color: color.trim(),
      images: uploadedImages,
      isActive: true
    });

    const inventoryDocs = parsedSizes.map(s => ({
      variant: variant._id,
      size: s.size,
      stock: s.stock,
      sku: generateSKU({
        slug: product.slug,
        color,
        size: s.size
      })
    }));

    await Inventory.insertMany(inventoryDocs);

    return res.status(HTTP_STATUS.CREATED).json({ message: "Variant added successfully" });

  } catch (err) {
    if (variant) {
      await Inventory.deleteMany({ variant: variant._id });
      await ProductVariant.deleteOne({ _id: variant._id });
    }

    for (const img of uploadedImages) {
      await deleteFromCloudinary(img.publicId);
    }

    throw err;
  }
});





export const updateVariant = asyncHandler(async (req, res) => {
  const { variantId } = req.params;
  const { color, sizes, existingImages } = req.body;

  const variant = await ProductVariant.findById(variantId).populate("product");
  if (!variant) {
    return res.status(404).json({ message: "Variant not found" });
  }

  /* ---------- Color Update ---------- */
  if (color) {
    const exists = await ProductVariant.findOne({
      _id: { $ne: variantId },
      product: variant.product._id,
      color: new RegExp(`^${color.trim()}$`, "i")
    });

    if (exists) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Color already exists" });
    }

    variant.color = color.trim();
  }

  /* ---------- Image Updates ---------- */

  const keptImages = Array.isArray(existingImages) ? existingImages : (existingImages ? [existingImages] : []);

  // Upload new images
  const uploadedImages = [];
  if (req.files && req.files.length > 0) {
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      uploadedImages.push({
        url: result.secure_url,
        publicId: result.public_id
      });
    }
  }

  // Build FINAL image list
  const finalImages = [
    ...variant.images.filter(img => keptImages.includes(img.url)),
    ...uploadedImages
  ];

  /* ---------- IMAGE VALIDATION ---------- */
  if (finalImages.length < 3 || finalImages.length > 4) {
    // Rollback uploaded images
    for (const img of uploadedImages) {
      await deleteFromCloudinary(img.publicId);
    }

    return res.status(400).json({
      message: "Variant must have between 3 and 4 images"
    });
  }

  // Delete removed images from Cloudinary
  const removedImages = variant.images.filter(
    img => !keptImages.includes(img.url)
  );

  for (const img of removedImages) {
    await deleteFromCloudinary(img.publicId);
  }

  variant.images = finalImages;

  /* ---------- Inventory Update ---------- */
  if (sizes) {
    let parsedSizes;
    try {
      parsedSizes = JSON.parse(sizes);
    } catch {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid sizes format" });
    }

    const sizeSet = new Set();

    if(parsedSizes.length === 0){
      return res.status(HTTP_STATUS.BAD_REQUEST).json({message : "Atleast one size is needed"})
    }
  for (const s of parsedSizes) {
    if (!Number.isInteger(s.size) || s.size <= 0 || s.stock < 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid size or stock" });
    }
    if (sizeSet.has(s.size)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: `Duplicate size ${s.size}` });
    }
    sizeSet.add(s.size);
  }




await Inventory.updateMany(
        { variant: variant._id },
        { $set: { isActive: false } }
      );

      // Upsert incoming sizes
      for (const s of parsedSizes) {
        await Inventory.findOneAndUpdate(
          { variant: variant._id, size: s.size },
          {
            $set: {
              stock: s.stock,
              isActive: true
            },
            $setOnInsert: {
              sku: generateSKU({
                slug: variant.product.slug,
                color: variant.color,
                size: s.size
              })
            }
          },
          { upsert: true }
        );
      }

  }

  await variant.save();

  return res.status(200).json({ message: "Variant updated successfully" });
});




// Variant status toggle
export const toggleVariantStatus = asyncHandler(async (req, res) => {
  const { variantId } = req.params;

  const variant = await ProductVariant.findById(variantId);
  if (!variant) {
    return res.status(404).json({ message: "Variant not found" });
  }

  variant.isActive = !variant.isActive;
  await variant.save();

  res.json({
    message: `Variant ${variant.isActive ? "enabled" : "disabled"}`
  });
});