import Product from "../../models/Product.model.js";
import Category from "../../models/Category.model.js"
import asyncHandler from "../../utils/asyncHandler.js";
import { uploadToCloudinary } from "../../utils/cloudinaryUpload.util.js";
import { generateSKU } from "../../utils/skuGenerator.util.js";
import { HTTP_STATUS } from "../../constants/httpStatus.js";

export const showProducts = asyncHandler(async(req,res)=>{

    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page-1)*limit;

    const [products,totalProducts] = await Promise.all([
        Product.find()
        .populate("category","name")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Product.countDocuments()
    ]);

    const now = new Date();

    // Offer status for admin UI

    const productWithOfferStatus = products.map((product)=>{
        let offerStatus = "No Offer";

        if(product.offerPercent){
            if(product.offerExpiry && product.offerExpiry > now){
                offerStatus = "Active";
            }else{
                offerStatus = "Expired";
            }
        }

    // thumbnail

    const thumbnail =  product.images?.[0]?.url ||"/images/placeholder.png";


        return {
            ...product.toObject(),
            offerStatus,
            thumbnail
        };
    });

    res.render("admin/products",{
        layout:"layouts/admin",
        products:productWithOfferStatus,
        currentPage:page,
        totalPage:Math.ceil(totalProducts / limit)
    });
});

// Data for AJAX

export const getProductsAjax = asyncHandler(async(req,res)=>{

    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page-1)*limit;

    const query = {
        name:{$regex:search , $options:"i"}
    };

    const [products,totalProducts] = await Promise.all([
        Product.find(query)
        .populate("category","name")
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Product.countDocuments(query)
    ]);

    const now = new Date();

    // Offer status for admin UI

    const productWithOfferStatus = products.map((product)=>{
        let offerStatus = "No Offer";

        if(product.offerPercent){
            if(product.offerExpiry && product.offerExpiry > now){
                offerStatus = "Active";
            }else{
                offerStatus = "Expired";
            }
        }

        // thumbnail

        const thumbnail =  product.images?.[0]?.url ||"/images/placeholder.png";

        return {
            ...product.toObject(),
            offerStatus,
            thumbnail
        };
    });

    res.status(200).json({
        products:productWithOfferStatus,
        currentPage:page,
        totalPages:Math.ceil(totalProducts / limit)
    });

})


// render add product

export const showAddProduct = asyncHandler(async (req, res) => {
    const categories = await Category.find({ isListed: true }).sort({ name: 1 });
  
    res.render("admin/add-product", {layout:false,categories});
  });


// Add Product

export const addProduct = asyncHandler(async (req, res) => {
    const {
      name,
      description,
      category,
      gender,
      color,
      price,
      offerPercent,
      offerExpiry,
      sizes
    } = req.body;
  
    // Basic validation
    if (!name || !description || !category || !gender || !color) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "All fields are required" });
    }
  
    if (Number(price) <= 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Price must be greater than 0" });
    }
  
    const allowedGenders = ["Men", "Women", "Unisex"];
    if (!allowedGenders.includes(gender)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid gender selected" });
    }
  
    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid category" });
    }
  
    // Image validation
    if (!req.files || req.files.length < 2 || req.files.length > 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product must have 2 to 4 images"});
    }
  
    let parsedSizes;
    try {
      parsedSizes = JSON.parse(sizes);
    } catch {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid size data" });
    }
  
    if (!Array.isArray(parsedSizes) || parsedSizes.length !== 5) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Sizes must include UK 6 to 10"});
    }
  
    let totalStock = 0;
  
    for (const s of parsedSizes) {
      if (![6, 7, 8, 9, 10].includes(Number(s.size))) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid shoe size detected" });
      }
  
      if (Number(s.stock) < 0) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Stock cannot be negative"});
      }
  
      totalStock += Number(s.stock);
    }
  
    if (totalStock === 0) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "At least one size must have stock"});
    }

    // Offer Validation

    let offerPrice = null;

    if (offerPercent != 0) {
      if (offerPercent <= 0 || offerPercent >= 90) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Offer percent must be between 1 and 90"});
      }
  
      if (offerPercent !=0 && !offerExpiry) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Offer expiry date is required"});
      }
  
      if (new Date(offerExpiry) <= new Date()) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Offer expiry must be a future date"});
      }
  
      offerPrice = Math.round(price - (price * offerPercent) / 100);
    }
 
    
    const nameExists = await Product.findOne({
      name: new RegExp(`^${name.trim()}$`, "i")
    });
  
    if (nameExists) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product with this name already exists"});
    }
  
    // Image upload
    const images = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      images.push({
        url: result.secure_url,
        publicId: result.public_id
      });
    }
 
    // SKU Generation
    const finalSizes = parsedSizes.map(s => ({
      size: Number(s.size),
      stock: Number(s.stock),
      sku: generateSKU({ productName: name, size: s.size })
    }));

    // Slug Generation
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

    // Save Product
    const product = new Product({
      name,
      slug,
      description,
      category,
      gender,
      color,
      price,
      offerPercent: offerPercent || null,
      offerPrice,
      offerExpiry: offerExpiry || null,
      images,
      sizes: finalSizes
    });
  
    await product.save();
  
    return res.status(HTTP_STATUS.CREATED).json({ message: "Product added successfully"});
  });
  



export const showEditProduct = asyncHandler(async (req,res)=>{
    const product = await Product.findById(req.params.id).populate("category","name");

    if(!product){
        req.flash("error","Product not found");
        return res.redirect("/admin/products"); 
    }

    return res.render("admin/editProduct",{product});
})




export const editProduct = asyncHandler(async (req,res)=>{
    const productId = req.params.id;

    const {name, description, category, gender, color, price, offerPercent, offerExpiry} = req.body;

    const product = await Product.findById(productId);

    if(!product){
        req.flash("error","Product not Found");
        return res.redirect("/admin/products");
    }

    if (!name || !description || !category || !gender || !price || !color) {
        req.flash("error", "Please fill all fields");
        return res.redirect(`/admin/products/edit/${productId}`);
    }

    if (name.trim() !== product.name) {
        const nameExists = await Product.exists({
          name: name.trim()
        });
    
        if (nameExists) {
          req.flash("error", "Product name already exists");
          return res.redirect(`/admin/products/edit/${productId}`);
        }
      }

    const categoryExists = await Category.findById(category);
    if (!categoryExists) {
        req.flash("error", "Invalid category");
        return res.redirect(`/admin/products/edit/${productId}`);
    }

    const allowedGenders = ["Men", "Women", "Unisex"];

    if (!allowedGenders.includes(gender)) {
        req.flash("error", "Invalid gender selected");
        return res.redirect(`/admin/products/edit/${productId}`);
    }
    // update fields

    product.name = name.trim();
    product.description = description;
    product.category = category;
    product.gender = gender;
    product.color = color;
    product.price = price;

    if(offerPercent){
        product.offerPercent = offerPercent;
        product.offerPrice = Math.round(price - (price * offerPercent) / 100);
    }else{
        product.offerPercent = null;
        product.offerPrice = null;
    }

    product.offerExpiry = offerExpiry || null;

    // For stock and images seperate functions

    await product.save();

    req.flash("success","Product updated Successfully");
    return res.redirect("/admin/products");
})


// Update product stock ajax

export const updateProductStock = asyncHandler(async (req,res)=>{

    const {productId, variantId, stocks} = req.body;

    if(!productId || !variantId || !Array.isArray(stocks)){
        return res.status(400).json({message:"Invalid stock update data"})
    }

    for(const item of stocks){
        await Product.updateOne(
            {_id:productId},
            {
                $set:{
                    "variants.$[v].sizes.$[s].stock":item.stock
                }
            },
            {
                arrayFilters:[
                    {"v._id":variantId},
                    {"s.size":item.size}
                ]
            }
        );
    }

    res.status(200).json({message:"Stock updated successfully"});
});


// toggle product status

export const toggleProductStatus = asyncHandler(async (req,res)=>{

    const productId = req.params.id;

    const product = await Product.findById(productId);

    if(!product){
        return res.status(400).json({message:"Product not found"});
    }

    product.isListed  = !product.isListed;
    await product.save();

    res.status(200).json({message:product.isListed ? "Product Listed":"Product Unlisted"});


})




