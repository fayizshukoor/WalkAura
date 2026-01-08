import Category from "../../models/Category.model.js";
import asyncHandler from "../../utils/asyncHandler.js";


// Render categories First time
export const showCategories = asyncHandler( async (req,res)=>{
    
    const page =  1;
    const limit = 5;
    const skip = 0;

    const [categories,totalCategories] = await Promise.all([
        Category.find()
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Category.countDocuments()
    ]);

    res.render("admin/categories",{
        layout:"layouts/admin",
        categories,
        currentPage:page,
        totalPages:Math.ceil( totalCategories/ limit)
    });
});


// Data for AJAX
export const getCategoriesData = asyncHandler( async (req,res)=>{
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;

    const limit = 5;
    const skip = (page-1) * limit;

    const query = {
        name:{$regex:search,$options:"i"}
    };

    const [categories,totalCategories] = await Promise.all([
        Category.find(query)
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Category.countDocuments(query)
    ]);

    res.status(200).json({
        categories,
        currentPage:page,
        totalPages:Math.ceil( totalCategories/ limit)
    });
})


// Add Category
export const addCategory = asyncHandler(async(req,res)=>{

    const {name,description,offer,offerExpiry} = req.body;

    if(!name || name.trim()===""){
        res.status(400).json({message:"Category name is required"});    
    }


    const exists = await Category.findOne({
        name:{$regex:`^${name.trim()}$`,$options:"i"}
    });

    
    if(exists){
        return res.status(429).json({message:"Category already exists"});
    }

    if(offer > 0 && !offerExpiry){
        return res.status(400).json({message:"Offer expiry date needed when offer is applied"});
    } 

    await Category.create({
        name:name.trim(),
        description:description?.trim(),
        offer:offer || 0,
        offerExpiry:offerExpiry || null
    });

    res.status(201).json({message:"Category added successfully"});
    
});


// Edit Category
export const editCategory = asyncHandler(async(req,res)=>{

    const {id} = req.params;
    const {name,description,offer,offerExpiry} = req.body;

    if(!name || name.trim()===""){
        res.status(400).json({message:"Category name is required"});    
    }


    const exists = await Category.findOne({
        _id:{$ne:id},
        name:{$regex:`^${name.trim()}$`,$options:"i"}
    });

    if(exists){
        return res.status(429).json({message:"Category already exists"});
    }


    if(offer > 0 && !offerExpiry){
        return res.status(400).json({message:"Offer expiry date required when offer is applied"});
    } 

    await Category.findByIdAndUpdate(id,{
        name:name.trim(),
        description:description?.trim(),
        offer:offer || 0,
        offerExpiry:offerExpiry || null
    });

    res.status(201).json({message:"Category updated successfully"});
    
});


// Toggle category status

export const toggleCategoryStatus = asyncHandler( async(req,res)=>{
    const id = req.params.id;

    const category = await Category.findById(id);

    if(!category){
        res.status(404).json({message:"Category not found"});
    }

    category.isListed = !category.isListed;
    await category.save();

    res.status(200).json({message:category.isListed ? "Category Listed":"Category Unlisted"});
})
