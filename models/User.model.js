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

    pendingEmail:{
        type:String,
        trim:true
    },

    phone:{
        type:String,
        trim:true,
        default:null
    },

    googleId:{
        type:String,
        unique:true,
        sparse:true
    },

    password:{
        type:String,
        default:null
    },

    isVerified:{
        type:Boolean,
        default:false
    },
    
    role:{
        type:String,
        enum:["user","admin"],
        default:"user"
    },

    isBlocked:{
        type:Boolean,
        default:false
    },

    profileImage: {
        url: String,
        public_id: String
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