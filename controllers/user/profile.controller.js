import User from "../../models/User.model.js"
export const showProfile = async(req,res)=>{
    try{

        const user = res.locals.user;
        if(!user){
            return res.redirect("/login");
        }
        return res.render("user/profile",{user});

    }catch(error){

        console.error("Error loading Profile",error);
        res.status(500).send("Server Error");

    }
}


export const showEditProfile = async (req,res)=>{

    try{

        const user = res.locals.user;
        
        if(!user){
            return res.redirect("/login")
        }

        return res.render("user/edit-profile");

    }catch(error){

        console.error("Error loading Edit profile:",error);
        res.status(500).send("server error");
    }
}

export const updateProfile = async (req,res)=>{

    const userId = req.user.userId;
    const { name, phone} = req.body;

      try {

        if (!name || !/^[A-Za-z ]+$/.test(name)) {
          req.flash("error","Name can only contain letters and spaces");
          return res.redirect("/profile/edit");
            
        }

        if (name.trim().length > 30 || name.trim().length < 3) {
          req.flash("error","Name should be between 3-30 characters");
          return res.redirect("/profile/edit");
    }
    
        const phoneRegex =  /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
          req.flash("error","Please enter a valid Phone Number");
          return res.redirect("/profile/edit");
      }
    
      await User.findByIdAndUpdate(userId,{
        name:name.trim(),
        phone:phone?.trim()
      })
      req.flash("success","Profile updated successfully");
        return res.redirect("/profile");
      

    }catch(error){

        console.error("Error updating Profile:",error);
        return res.redirect("/profile");

    }
}

// Change Email
export const showChangeEmail = (req,res)=>{
    return res.render("user/change-email");
}

