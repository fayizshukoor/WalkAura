import crypto from "crypto";
import nodemailer from "nodemailer";
import OTP from "../models/OTP.model.js";


export const sendOTP = async(email)=>{

         try{

            // Rate limiting: Check if OTP was sent recently

        const recentOTP = await OTP.findOne({
            email,
            createdAt:{$gte: new Date(Date.now()-30000)}
        });

        if(recentOTP){
            throw new Error("OTP_RATE_LIMIT");
        }
        // Generating OTP
        const otp = crypto.randomInt(100000,999999).toString();

        //Delete old OTPs for this email
        await OTP.deleteMany({email});

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
            subject: "OTP Verification",
            html: `<p>Your OTP is: <strong>${otp}</strong></p>
                    <p>Valid for 5 minutes.</p>`
        });

        await OTP.create({
            email,
            otp
        });

        return true;

         }catch(error){
            console.error("Error sending OTP",error);
            throw error;

         }
       

   
};



