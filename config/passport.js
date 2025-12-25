import dotenv from "dotenv";
dotenv.config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.model.js";
console.log("GOOGLE_CLIENT_ID:", process.env.GOOGLE_CLIENT_ID);

passport.use(
    new GoogleStrategy(
        {
            clientID:process.env.GOOGLE_CLIENT_ID,
            clientSecret:process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:"http://localhost:4000/auth/google/callback"
        },

        async (accessToken, refreshToken, profile, done)=>{
            try{
                const email = profile.emails[0].value;

                let user = await  User.findOne({email});

                if(!user){
                    user = await User.create({
                        name:profile.displayName,
                        email,
                        googleId:profile.id,
                        isVerified:true
                    });
                }
                return done(null,user);

            }catch(error){
                return done(error,null);

            }
        }
        
    )
);

export default passport;
