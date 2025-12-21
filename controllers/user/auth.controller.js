import User from "../../models/User.model.js";
import bcrypt from "bcryptjs";
import {sendOTP} from "../../utils/generateAndSendOtp.util.js";
import { generateAccessToken,generateRefreshToken } from "../../utils/jwt.utils.js";


export const showSignup = async (req, res) => {
  try {
    return res.render("user/signup");
  } catch (error) {
    console.log("error loading Signup");
    res.status(500).send("Server error");
  }
};

export const signup = async (req, res) => {
  const { name, email, phone, password } = req.body;
  try {
    if (!name || !/^[A-Za-z ]+$/.test(name)) {
      return res
        .status(400)
        .render("user/signup", { error: "Name can only contain letters" });
    }

    if (password.length < 6) {
      return res.render("user/signup", {
        error: "Password need minimum 6 characters",
      });
    }

    const existingUser = await User.findOne({ email });

    if (existingUser && existingUser.isVerified) {
      return res.render("user/signup", { error: "Email Already Registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.findOneAndUpdate(
      { email },
      {
        name,
        phone,
        password: hashedPassword,
        isVerified: false,
      },
      { upsert: true, new: true }
    );

    await sendOTP(email);

    req.session.email = email;

    
    console.log(newUser);
    return res.redirect("/verify-otp");
  } catch (error) {
    console.error("Error Saving User", error);
    res.status(500).send("Internal Server Error");
  }
};


export const showVerifyOTP = async(req,res)=>{

    try{

        return res.render("user/verify-otp");

    }catch(error){

        console.error("Error loading Verify OTP Page");
    }
}

export const showLogin = async (req, res) => {
  try {
    return res.render("user/login");
  } catch (error) {
    console.log("error loading Login Page",error);
    res.status(500).send("Server error");
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({email});

  if(!user || !user.isVerified){
    return res.render("user/login",{error:"Invalid Email"})
  }

  const isMatch = await bcrypt.compare(password,user.password);

  if(!isMatch){
    return res.render("user/login",{error:"Password Incorrect"});
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);
  
  user.refreshToken = refreshToken;
  await user.save();

  res.cookie("accessToken",accessToken,{
    httpOnly:true,
    secure:process.env.NODE_ENV === "production",
    maxAge:15*60*1000
  });

  res.cookie("refreshToken",refreshToken,{
    httpOnly:true,
    secure:process.env.NODE_ENV === "production",
    maxAge:7*24*60*60*1000
  })


  res.redirect("/home");
};


export const logout = async(req,res)=>{

  try{

    if(req.user?.userId){
    await User.findOneAndUpdate(
      {_id:req.user.userId},
      {refreshToken:null}
    );
  }

  res.clearCookie("accessToken");
  res.clearCookie("refreshToken");

  return res.redirect("/login");

  }catch(error){

    console.error("Logout Error:",error);
    return res.redirect("/login");

  }


}