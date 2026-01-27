import { HTTP_STATUS } from "../../constants/httpStatus.js";
import Category from "../../models/Category.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import { expireCategoryOffers } from "../../utils/expireCategoryOffers.js";


// Render categories First time
export const showCategories = asyncHandler( async (req,res)=>{
    
    await expireCategoryOffers();

    const page =  1;
    const limit = 3;
    const skip = 0;

    const [categories,totalCategories] = await Promise.all([
        Category.find({isDeleted:false})
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Category.countDocuments({isDeleted:false})
    ]);

    res.render("admin/categories",{
        layout:"layouts/admin",
        categories,
        currentPage:page,
        totalPages:Math.ceil( totalCategories/ limit)
    });
});


// Data for AJAX
export const getCategoriesAjax = asyncHandler( async (req,res)=>{

    await expireCategoryOffers();
    
    const search = req.query.search?.trim() || "";
    const page = parseInt(req.query.page) || 1;

    const limit = 3;
    const skip = (page-1) * limit;

    const query = {
        isDeleted : false,
        name:{$regex:search,$options:"i"}
    };

    const [categories,totalCategories] = await Promise.all([
        Category.find(query)
        .sort({createdAt:-1})
        .skip(skip)
        .limit(limit),
        Category.countDocuments(query)
    ]);

    return res.status(200).json({
        categories,
        currentPage:page,
        totalPages:Math.ceil( totalCategories/ limit)
    });
})


// Add Category
export const addCategory = asyncHandler(async(req,res)=>{

    const {name,description,offerPercent,offerExpiry} = req.body;

    if(!name || name.trim()===""){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category name is required"});    
    }

    if(offerPercent < 0 || offerPercent > 90){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer should be between 0 and 90"});
    }

    if(offerPercent > 0 && !offerExpiry){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer expiry date needed when offer is applied"});
    } 

    if(new Date(offerExpiry) < new Date()){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Please set a future expiry date"});
    }

    const existingCategory = await Category.findOne({
        name:{$regex:`^${name.trim()}$`,$options:"i"},
    });

    if (existingCategory && existingCategory.isDeleted) {
        existingCategory.isDeleted = false;
        existingCategory.isListed = true;
        existingCategory.description = description?.trim();
        existingCategory.offerPercent = offerPercent || 0;
        existingCategory.offerExpiry = offerExpiry || null;
    
        await existingCategory.save();
    
        return res.status(200).json({message: "Category restored successfully" });
      }

      if(existingCategory){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category already exists"});
    }

    await Category.create({
        name:name.trim(),
        description:description?.trim(),
        offerPercent:offerPercent || 0,
        offerExpiry:offerExpiry || null
    });

    res.status(201).json({message:"Category added successfully"});
    
});


// Edit Category
export const editCategory = asyncHandler(async(req,res)=>{

    const {id} = req.params;
    const {name,description,offerPercent,offerExpiry} = req.body;

    if(!name || name.trim()===""){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category name is required"});    
    }

    if(offerPercent < 0 || offerPercent > 90){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer should be between 0 and 90"});
    }

    if(offerPercent > 0 && !offerExpiry){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Offer expiry date needed when offer is applied"});
    } 

    if(new Date(offerExpiry) < new Date()){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Please set a future expiry date"});
    }

    const existingCategory = await Category.findOne({
        _id:{$ne:id},
        name:{$regex:`^${name.trim()}$`,$options:"i"},
    });

    if (existingCategory && existingCategory.isDeleted) {
        existingCategory.isDeleted = false;
        existingCategory.isListed = true;
        existingCategory.description = description?.trim();
        existingCategory.offerPercent = offerPercent || 0;
        existingCategory.offerExpiry = offerExpiry || null;
    
        await existingCategory.save();
    
        return res.status(200).json({message: "Category restored successfully" });
      }

    if(existingCategory){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category already exists"});
    }


    await Category.findByIdAndUpdate(id,{
        name:name.trim(),
        description:description?.trim(),
        offerPercent:offerPercent || 0,
        offerExpiry:offerExpiry || null
    });

    res.status(HTTP_STATUS.CREATED).json({message:"Category updated successfully"});
    
});


// Toggle category status

export const toggleCategoryStatus = asyncHandler( async(req,res)=>{
    const id = req.params.id;

    const category = await Category.findById(id);

    if(!category){
        return res.status(404).json({message:"Category not found"});
    }

    category.isListed = !category.isListed;
    await category.save();

    res.status(HTTP_STATUS.OK).json({message:category.isListed ? "Category Listed":"Category Unlisted"});
})


// Soft delete Category 

export const softDeleteCategory = asyncHandler(async (req,res)=>{
    const {id} = req.params;

    const category = await Category.findById(id);

    if(!category){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category not found"});
    }

    if(category.isDeleted){
        return res.status(HTTP_STATUS.BAD_REQUEST).json({message:"Category already Deleted"});
    }

    category.isDeleted = true;
    category.isListed = false;
    await category.save();

    return res.status(HTTP_STATUS.OK).json({message:"Category Deleted Successfully"});
})