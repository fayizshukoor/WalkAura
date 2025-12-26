import dotenv from "dotenv";
dotenv.config();
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/User.model.js";

passport.use(
    new GoogleStrategy(
        {
            clientID:process.env.GOOGLE_CLIENT_ID,
            clientSecret:process.env.GOOGLE_CLIENT_SECRET,
            callbackURL:"/auth/google/callback"
        },

        async (accessToken, refreshToken, profile, done)=>{
            try{
                const email = profile.emails[0]?.value;

                if(!email){
                    return done(null,false,{
                        message:"Google account does not have an email"
                    });
                }

                const existingLocalUser = await User.findOne({
                    email,
                    googleId:{$exists:false}
                });

                if(existingLocalUser){
                    return done(null,false,{
                        message:"This email is registered with Password login"
                    });
                }

                let user = await  User.findOne({googleId:profile.id});

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
