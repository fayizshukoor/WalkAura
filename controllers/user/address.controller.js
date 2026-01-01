import Address from "../../models/Address.model.js";
import User from "../../models/User.model.js";

export const showAddressManagement = async (req,res)=>{
    try {
    const addresses = await Address.find({
      userId: req.user.userId
    }).sort({ isDefault: -1, createdAt: -1 });

    res.render("user/address-management", { addresses });
  } catch (error) {
    console.error("Error loading addresses:", error);
    res.redirect("/profile");
  }
};

export const addAddress = async (req, res) => {
  try {
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

    // Optional: simple phone & pincode validation
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
      streetAddress, // 🔥 mapping happens here
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

  } catch (error) {
    console.error("Error adding address:", error);
    req.flash("error", "Something went wrong");
    res.redirect("/addresses");
  }
};

// controllers/user/address.controller.js


export const updateAddress = async (req, res) => {
  try {
    const userId = req.user.userId; // from JWT
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
        console.log("hi");
      req.flash("error", "Address not found");
      return res.redirect("/addresses");
    }

    //  Update fields
    address.fullName = fullName;
    address.phone = phone;
    address.pincode = pincode;
    address.streetAddress = streetAddress; // IMPORTANT mapping
    address.city = city;
    address.state = state;

    await address.save();

    //  Success feedback
    req.flash("success", "Address updated successfully");
    res.redirect("/addresses");

  } catch (error) {
    console.error("Update address error:", error);
    req.flash("error", "Failed to update address");
    res.redirect("/addresses");
  }
};

export const deleteAddress = async (req, res) => {
  try {
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

  } catch (error) {
    console.error("Delete address error:", error);
    req.flash("error", "Something went wrong while deleting address");
    return res.redirect("/addresses");
  }
};

