import crypto from "crypto";
import nodemailer from "nodemailer";
import OTP from "../models/OTP.model.js";


const emailTemplates = {
  SIGNUP: {
    subject: "Verify your email",
    body: (otp) => `
      <p>Your signup OTP is <strong>${otp}</strong></p>
      <p>Valid for 5 minutes.</p>
    `
  },
  FORGOT_PASSWORD: {
    subject: "Reset your password",
    body: (otp) => `
      <p>Your password reset OTP is <strong>${otp}</strong></p>
      <p>Valid for 5 minutes.</p>
    `
  },
  EMAIL_CHANGE: {
    subject: "Confirm your new email",
    body: (otp) => `
      <p>Use this OTP to confirm your email change:</p>
      <strong>${otp}</strong>
    `
  }
};

export const sendOTP = async(email,purpose)=>{

         try{

            // Rate limiting: Check if OTP was sent recently

        const recentOTP = await OTP.findOne({
            email,
            purpose,
            createdAt:{$gte: new Date(Date.now()-30*1000)}
        });

        if(recentOTP){
            throw new Error("OTP_RATE_LIMIT");
        }
        // Generating OTP
        const otp = crypto.randomInt(100000,999999).toString();

        const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

        //Delete old OTPs for this email
        await OTP.deleteMany({email,purpose});

        //Send Email first
        const transporter = nodemailer.createTransport({
            service:"gmail",
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        });

        await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to: email,
            subject: emailTemplates[purpose].subject,
            html: emailTemplates[purpose].body(otp)
        });

        await OTP.create({
            email,
            otp:hashedOtp,
            purpose
        });

        return true;

         }catch(error){
            console.error("Error sending OTP",error);
            throw error;

         }
       

   
};



