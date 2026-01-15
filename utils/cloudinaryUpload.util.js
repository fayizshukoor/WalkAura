import cloudinary from "../config/cloudinary.js";

export const uploadToCloudinary = (
  buffer,
  {
    folder = "walkaura/products",
    width = 1000,
    height = 1000,
    crop = "fill"
  } = {}
) => {
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [
          {
            width,
            height,
            crop,
            gravity: "auto"
          }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    ).end(buffer);
  });
};

export const deleteFromCloudinary = async (publicId)=>{
  if(!publicId)
    return;

  try{
    await cloudinary.uploader.destroy(publicId);
  }catch(error){
    console.log("Cloudinary delete failed",error);
    throw error;

  }
}