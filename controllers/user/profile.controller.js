import User from "../../models/User.model.js";
import cloudinary from "../../config/cloudinary.js";
import asyncHandler from "../../utils/asyncHandler.js";

export const showProfile =  (req, res) => {
    const user = res.locals.user;
    if (!user) {
      return res.redirect("/login");
    }
    return res.render("user/profile", { user });
};

export const showEditProfile =  (req, res) => {
  const user = res.locals.user;

    if (!user) {
      return res.redirect("/login");
    }

    return res.render("user/edit-profile");

};

// Edit Profile
export const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const { name, phone } = req.body;

    if (!name || !/^[A-Za-z ]+$/.test(name)) {
      req.flash("error", "Name can only contain letters and spaces");
      return res.redirect("/profile/edit");
    }

    if (name.trim().length > 30 || name.trim().length < 3) {
      req.flash("error", "Name should be between 3-30 characters");
      return res.redirect("/profile/edit");
    }

    const phoneRegex = /^[6-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      req.flash("error", "Please enter a valid Phone Number");
      return res.redirect("/profile/edit");
    }

    await User.findByIdAndUpdate(userId, {
      name: name.trim(),
      phone: phone?.trim(),
    });
    req.flash("success", "Profile updated successfully");
    return res.redirect("/profile");

});


export const uploadProfilePhoto = asyncHandler(async (req, res) => {

  if (!req.file) {
      req.flash("error", "Please select an image");
      return res.redirect("/profile");
    }

    const user = await User.findById(req.user.userId);

    // Remove old image
    if (user.profileImage?.public_id) {
      await cloudinary.uploader.destroy(user.profileImage.public_id);
    }

    // Upload new image
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`,
      {
        folder: "walkaura/profile",
        transformation: [
          { width: 300, height: 300, crop: "fill", gravity: "face" },
        ],
      }
    );

    user.profileImage = {
      url: result.secure_url,
      public_id: result.public_id,
    };

    await user.save();

    req.flash("success", "Profile photo updated");
    res.redirect("/profile");

});

// Remove profile photo
export const removeProfilePhoto = asyncHandler(async (req, res) => {
   
  const user = await User.findById(req.user.userId);

    // If no image exists
    if (!user.profileImage?.public_id) {
      req.flash("error", "No profile photo to remove");
      return res.redirect("/profile");
    }

    // Remove from Cloudinary
    await cloudinary.uploader.destroy(user.profileImage.public_id);

    // Remove from DB
    user.profileImage = null;
    await user.save();

    req.flash("success", "Profile photo removed");
    res.redirect("/profile");

});
