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
        index:true
    },

    phone:{
        type:String,
        trim:true
    },

    googleId:{
        type:String,
        unique:true
    },

    password:{
        type:String
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

    referralCode:{
        type:String,
        unique:true     
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