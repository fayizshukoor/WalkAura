import Product from "../../models/Product.model.js";
import Category from "../../models/Category.model.js"
import asyncHandler from "../../utils/asyncHandler.js";
import { deleteFromCloudinary, uploadToCloudinary } from "../../utils/cloudinaryUpload.util.js";
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

    const formattedProducts = products.map((product)=>{
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
    
    // Total stock 
    const totalStock = product.sizes?.reduce((sum,size)=>sum + (size.stock || 0),0) || 0;


        return {
            ...product.toObject(),
            offerStatus,
            thumbnail,
            totalStock
        };
    });

    res.render("admin/products",{
        layout:"layouts/admin",
        products:formattedProducts,
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

    const formattedProducts = products.map((product)=>{
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

        // Total Stock
        const totalStock = product.sizes?.reduce((sum,size)=>sum + (size.stock || 0),0) || 0;

        return {
            ...product.toObject(),
            offerStatus,
            thumbnail,
            totalStock
        };
    });

    res.status(200).json({
        products:formattedProducts,
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
    if (!req.files || req.files.length !== 4) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product must have 4 images"});
    }
  
    let parsedSizes;
    try {
      parsedSizes = JSON.parse(sizes);
    } catch {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid size data" });
    }
  
    if (!Array.isArray(parsedSizes) || parsedSizes.length !== 5) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Sizes must include 6 to 10"});
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
      if (offerPercent <= 0 || offerPercent > 90) {
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
 
    // SKU Generation
    const finalSizes = parsedSizes.map(s => ({
      size: Number(s.size),
      stock: Number(s.stock),
      sku: generateSKU({ productName: name, size: s.size })
    }));


    // Image upload
    const images = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer);
      images.push({
        url: result.secure_url,
        publicId: result.public_id
      });
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
    const categories = await Category.find({ isListed: true }).sort({ name: 1 });

    if(!product){
        req.flash("error","Product not found");
        return res.redirect("/admin/products"); 
    }

    return res.render("admin/edit-product",{
      layout:false,
      product,
      categories
    });
})




export const editProduct = asyncHandler(async (req,res)=>{
    const productId = req.params.id;

    const {name, description, category, gender, color, price, offerPercent, offerExpiry,sizes} = req.body;

    const product = await Product.findById(productId);

    if(!product){
        req.flash("error","Product not Found");
        return res.redirect("/admin/products");
    }

    if (!name || !description || !category || !gender || !color) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Please fill all General Details"});
    }

    // edit name if changed
    if (name.trim() !== product.name) {
        const nameExists = await Product.findOne({
          _id:{$ne : productId},
          name: new RegExp(`^${name.trim()}$`,"i")
        });
    
        if (nameExists) {
          return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Product name already Exists"});
        }

        product.name = name;

        // Regenerate slug if name changed
        const baseSlug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"");
        let slug = baseSlug;
        let count = 1;
        while(await Product.findOne({slug,_id:{$ne:productId} })){
          slug = `${baseSlug}-${count++}`;
        }

        product.slug = slug;
      }

    if(category){
      const categoryExists = await Category.findById(category);
    if (!categoryExists) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Invalid Category Selected"});
    }
    }

    const allowedGenders = ["Men", "Women", "Unisex"];

    if (!allowedGenders.includes(gender)) {
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Invalid Gender Selected"});
    }

    if(price !== undefined && Number(price)<=0){
      return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Price should be above Zero"});
    }
    // update fields

    product.description = description;
    product.category = category;
    product.gender = gender;
    product.color = color;
    product.price = price;

    if(offerPercent > 0  && offerPercent != product.offerPercent){
      if(offerPercent < 1 || offerPercent > 90){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer Percent must be between 1 to 90"});
      }

      if(!offerExpiry){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer Expiry is required"});
      }

      if(new Date(offerExpiry) <= new Date()){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer Expiry must be a future Date"});
      }
        product.offerPercent = offerPercent;
        product.offerPrice = Math.round(price - (price * offerPercent) / 100);
        product.offerExpiry = offerExpiry
    }else{
        product.offerPercent = null;
        product.offerPrice = null;
        product.offerExpiry = null;
    }

    

    // Stock and size Update

    if (sizes) {
  let parsedSizes;

  try {
    parsedSizes = JSON.parse(sizes);
  } catch {
    return res.status(400).json({ message: "Invalid size data" });
  }

  let totalStock = 0;

  const updatedSizes = parsedSizes.map(s => {
    if (![6,7,8,9,10].includes(Number(s.size))) {
      throw new Error("Invalid shoe size");
    }
    if (Number(s.stock) < 0) {
      throw new Error("Stock cannot be negative");
    }

    totalStock += Number(s.stock);

    return {
      size: Number(s.size),
      stock: Number(s.stock),
      // KEEP OLD SKU if exists
      sku:
        product.sizes.find(ps => ps.size === Number(s.size))?.sku ||
        generateSKU({ productName: product.name, size: s.size })
    };
  });

  if (totalStock === 0) {
    return res.status(400).json({ message: "At least one size must have stock" });
  }

  product.sizes = updatedSizes;
}



/* -------- IMAGE UPDATE (EXACTLY 4 RULE) -------- */

if (req.files && req.files.length > 0) {
  let imageMappings = req.body.imageMapping;

  if (!Array.isArray(imageMappings)) {
    imageMappings = [imageMappings];
  }

  imageMappings = imageMappings.map(i => Number(i));

  if (imageMappings.length !== req.files.length) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Image mapping mismatch"});
  }

  if (product.images.length !== 4) {
    return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Product image set is corrupted"});
  }

  for (let i = 0; i < req.files.length; i++) {
    const index = imageMappings[i];

    if (index < 0 || index > 3) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({ message: "Invalid image slot"});
    }

    // delete old
    if (product.images[index]?.publicId) {
      await deleteFromCloudinary(product.images[index].publicId);
    }

    // upload new
    const result = await uploadToCloudinary(req.files[i].buffer);

    product.images[index] = {
      url: result.secure_url,
      publicId: result.public_id
    };
  }
}



    await product.save();

    return res.status(HTTP_STATUS.OK).json({message:"Product updated Successfully"});
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




