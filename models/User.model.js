import mongoose from "mongoose";
const {Schema} = mongoose;

const userSchema = new Schema(
{

    name:{
        type:String,
        required:true,
        trim:true
    },

    email:{
        type:String,
        required:true,
        unique:true,
        lowercase:true,
    },

    phone:{
        type:String,
        trim:true
    },

    googleId:{
        type:String,
        unique:true,
        sparse:true
    },

    password:{
        type:String
    },

    otp:{
        type:String,
    },
    
    otpExpiry:{
        type:Date
    },

    isVerified:{
        type:Boolean,default:false
    },
    
    isAdmin:{
        type:Boolean,
        default:false
    },

    isBlocked:{
        type:Boolean,
        default:false
    },

    profileImage:{
        type:String
    },

    passwordChangedAt:{
        type:Date
    }
},

    {
        timestamps:true
    }
);

export default mongoose.model("User",userSchema);