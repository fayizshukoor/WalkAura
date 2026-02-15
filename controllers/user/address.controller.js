import Address from "../../models/Address.model.js";
import asyncHandler from "../../utils/asyncHandler.js";
import pincodeLookup from "india-pincode-lookup";

// Show address Page (Initial Render)
export const showAddressManagement = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const [addresses, totalAddress] = await Promise.all([
        Address.find({ userId, isDeleted: false }).sort({ isDefault: -1,createdAt: -1 }).skip(skip).limit(limit),
        Address.countDocuments({ userId, isDeleted: false })
    ]);

    const totalPages = Math.ceil(totalAddress / limit);
    res.render("user/address-management", { addresses, currentPage: page, totalPages });
});

// AJAX: Add Address
export const addAddress = asyncHandler(async (req, res) => {
    const { fullName, phone, pincode, streetAddress, city, state, isDefault } = req.body;
    console.log(req.body);

    // Strict Server-side Validation
    if (!fullName || !phone || !streetAddress || !city || !state || !pincode) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    if (!/^\d{10}$/.test(phone)) {
        return res.status(400).json({ success: false, message: "Invalid 10-digit phone number" });
    }

    if (!/^\d{6}$/.test(pincode)) {
        return res.status(400).json({ success: false, message: "Invalid 6-digit pincode" });
    }

    if(isDefault === true){
        const defaultAddress = await Address.findOne({isDefault: true});

        if(defaultAddress){
            defaultAddress.isDefault = false;
            await defaultAddress.save();
        }
    }
    const address = await Address.create({
        userId: req.user.userId,
        fullName,
        phone,
        streetAddress,
        city,
        state,
        pincode,
        isDefault,
        country: "India"
    });

    return res.status(201).json({ 
        success: true, 
        message: "Address added successfully", 
        address 
    });
});

// AJAX: Update Address
export const updateAddress = asyncHandler(async (req, res) => {
    const userId = req.user.userId;
    const { addressId } = req.params;
    const { fullName, phone, pincode, streetAddress, city, state, isDefault } = req.body;

    const address = await Address.findOne({ _id: addressId, userId, isDeleted: false });

    if (!address) {
        return res.status(404).json({ success: false, message: "Address not found" });
    }

    // Validation
    if (!fullName || !phone || !pincode || !streetAddress || !city || !state) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    // Update
    Object.assign(address, { fullName, phone, pincode, streetAddress, city, state, isDefault });

    // Remove existing default address
    const defaultAddress = await Address.findOne({isDefault: true});


    if(defaultAddress){
        defaultAddress.isDefault = false;
        await defaultAddress.save();
    }

    await address.save();

    return res.status(200).json({ 
        success: true, 
        message: "Address updated successfully" 
    });
});

// AJAX: Delete Address
export const deleteAddress = asyncHandler(async (req, res) => {
    const { addressId } = req.params;
    const userId = req.user.userId;

    const deletedAddress = await Address.findOneAndUpdate(
        { _id: addressId, userId: userId },
        { $set: { isDeleted: true } },
        { new: true }
    );

    if (!deletedAddress) {
        return res.status(404).json({ success: false, message: "Address not found" });
    }

    return res.status(200).json({ 
        success: true, 
        message: "Address deleted successfully" 
    });
});


export const getPincodeDetails = asyncHandler(async (req, res)=>{
    const {code} = req.params;

    if (!/^\d{6}$/.test(code)) {
        return res.status(400).json({ success: false, message: "Invalid pincode format" });
    }
    const results = pincodeLookup.lookup(code);

        if (results && results.length > 0) {
            // Helper to title-case names (e.g., "BANGALORE" -> "Bangalore")
            const formatName = (str) => str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());

            return res.json({
                success: true,
                city: formatName(results[0].districtName),
                state: formatName(results[0].stateName)
            });
        }

        return res.status(404).json({ success: false, message: "Pincode not found" });
})