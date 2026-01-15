  import mongoose from "mongoose";

  // Size Schema

  const sizeSchema = new mongoose.Schema(
      {
          size:{
              type:Number,
              enum:[6,7,8,9,10],
              required:true 
          },
          sku: {
            type: String,
            required: true,
            index: true
          },
          stock:{
              type:Number,
              min:0,
              required:true,
              default:0
          },
      },
      {_id:false}
  );


  // Review Schema

  const reviewSchema = new mongoose.Schema(
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        rating: {
          type: Number,
          min: 1,
          max: 5,
          required: true,
        },
        comment: {
          type: String,
          trim: true,
        },
      },
      { timestamps: true }
    );


  // Product Schema

  const productSchema = new mongoose.Schema(
      {
        name: {
          type: String,
          required: true,
          trim: true,
        },

        slug:{
          type:String,
          unique:true,
          index:true
        },

        description: {
          type: String,
          required: true,
        },
    
        category: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Category",
          required: true,
        },
    
        gender: {
          type: String,
          enum: ["Men", "Women", "Unisex"],
          required: true,
        },

        color:{
          type:String,
          required:true,
          trim:true
        },

        images:{
          type:[
            {
              url:{
                type:String,
                required:true
              },
              publicId:{
                type:String,
                required:true
              }
            }
          ],
          required:true,
          validate:{
              validator: imgs => imgs.length >= 2 && imgs.length <=4,
              message: "Product must have 2 to 4 images" 
            }
        },

        sizes:{
          type:[sizeSchema],
          required:true,
          validate:{
            validator:sizes => sizes.length === 5,
            message: "Sizes must be from 6 to 10"
          }
        },
    
        // Price
        price: {
          type: Number,
          min: 0,
          required: true,
        },
    
        // source of truth for product-level offer
        offerPercent: {
          type: Number,
          min: 0,
          max: 90,
        },
    
        // derived from price & offerPercent
        offerPrice: {
          type: Number,
          min: 0,
        },
    
        offerExpiry: {
          type: Date,
        },
    
        // visibility
        isListed: {
          type: Boolean,
          default: true,
        },
    
        // Reviews
        reviews: [reviewSchema],
    
        averageRating: {
          type: Number,
          default: 0,
        },
      },
      { timestamps: true }
    );

    export default mongoose.model("Product",productSchema);
  