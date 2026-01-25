import mongoose from "mongoose";

const categorySchema = new mongoose.Schema(
    {
        name: {
          type: String,
          required: true,
          trim: true,
          minlength: 2,
          maxlength: 30
        },
    
        description: {
          type: String,
          trim: true,
          maxlength: 200
        },
    
        isListed: {
          type: Boolean,
          default: true
        },

        isDeleted:{
          type : Boolean,
          default:false
        },
    
        offer: {
          type: Number, 
          min: 0,
          max: 90,
          default: 0
        },
    
        offerExpiry: {
          type: Date,
          default: null
        }
      },
      {
        timestamps: true
      }
);

export default mongoose.model("Category",categorySchema);