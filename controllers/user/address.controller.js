import Address from "../../models/Address.model.js";
import User from "../../models/User.model.js";
import asyncHandler from "../../utils/asyncHandler.js";

// Show address Page
export const showAddressManagement = asyncHandler(async (req,res)=>{
      const userId = req.user.userId;

      const page = parseInt(req.query.page) || 1;
      const limit = 5;
      const skip = (page-1)*limit;

    const addresses = await Address.find({userId}).sort({createdAt:-1}).skip(skip).limit(limit);

    const totalAddress = await Address.countDocuments({userId});
    const totalPages = Math.ceil(totalAddress/limit);

    res.render("user/address-management", { addresses , currentPage:page, totalPages});
});


// Address Adding
export const addAddress = asyncHandler(async (req, res) => {
    const {
      fullName,
      phone,
      pincode,
      streetAddress,  
      city,
      state,
      country
    } = req.body;

    // Basic validation 
    if (!fullName || !phone || !streetAddress || !city || !state || !pincode) {
      req.flash("error", "All required fields must be filled");
      return res.redirect("/addresses");
    }

   
    if (!/^\d{10}$/.test(phone)) {
      req.flash("error", "Enter a valid 10-digit phone number");
      return res.redirect("/addresses");
    }

    if (!/^\d{6}$/.test(pincode)) {
      req.flash("error", "Enter a valid 6-digit pincode");
      return res.redirect("/addresses");
    }

    // Check if this is the first address
    const hasAddress = await Address.exists({
      userId: req.user.userId
    });

    //  Create address
    const address = await Address.create({
      userId: req.user.userId,
      fullName,
      phone,
      streetAddress, 
      city,
      state,
      pincode,
      country,
      isDefault: !hasAddress
    });

    //  Store reference in user document
    await User.findByIdAndUpdate(req.user.userId, {
      $push: { addresses: address._id }
    });

    req.flash("success", "Address added successfully");
    res.redirect("/addresses");
});


// controllers/user/address.controller.js


export const updateAddress = asyncHandler(async (req, res) => {

    const userId = req.user.userId; 
    const { addressId } = req.params;
    console.log(addressId);
    console.log(userId);

    const {
      fullName,
      phone,
      pincode,
      streetAddress,
      city,
      state
    } = req.body;

    //  Find address owned by user
    const address = await Address.findOne({
      _id: addressId,
      userId: userId
    });

    if (!address) {
        
      req.flash("error", "Address not found");
      return res.redirect("/addresses");
    }

    // Basic validation 
    if (!fullName || !phone || !pincode || !streetAddress || !city || !state ) {
      req.flash("error", "All required fields must be filled");
      return res.redirect("/addresses");
    }

   
    if (!/^\d{10}$/.test(phone)) {
      req.flash("error", "Enter a valid 10-digit phone number");
      return res.redirect("/addresses");
    }

    if (!/^\d{6}$/.test(pincode)) {
      req.flash("error", "Enter a valid 6-digit pincode");
      return res.redirect("/addresses");
    }

    //  Update fields
    address.fullName = fullName;
    address.phone = phone;
    address.pincode = pincode;
    address.streetAddress = streetAddress; 
    address.city = city;
    address.state = state;

    await address.save();

    //  Success feedback
    req.flash("success", "Address updated successfully");
    res.redirect("/addresses");

});

export const deleteAddress = asyncHandler(async (req, res) => {

  const { addressId } = req.params;
    const userId = req.user.userId; // from JWT

    // delete only if address belongs to user
    const deletedAddress = await Address.findOneAndDelete({
      _id: addressId,
      userId: userId
    });

    if (!deletedAddress) {
      req.flash("error", "Address not found or not authorized");
      return res.redirect("/addresses");
    }

    req.flash("success", "Address deleted successfully");
    return res.redirect("/addresses");


});

