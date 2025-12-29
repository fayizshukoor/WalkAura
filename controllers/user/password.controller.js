export const showForgotPassword = async (req,res)=>{
    try{
        //Clear any previous OTP
          delete req.session.email;
          delete req.session.otpPurpose;
          delete req.session.allowPasswordReset;
          
          res.render("user/forgot-password");

    }catch(error){
        console.error("Error loading forgot password",error);
    }
}

export const showResetPassword = (req,res)=>{
    try{

        if(!req.session.allowPasswordReset || !req.session.email){
            res.redirect("/forgot-password");
        }
        res.render('user/reset-password');
    }catch(error){
        console.error("Error loading reset Password",error);

    }
}