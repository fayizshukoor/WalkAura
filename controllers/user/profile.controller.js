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
          return res
            .status(400)
            .render("user/signup", { error: "Name can only contain letters and spaces" });
        }

        if (name.trim().length > 30 || name.trim().length < 3) {
      return res.render("user/signup", {
        error: "Name should be between 3-30 characters",
      });
    }
    
        const phoneRegex =  /^[6-9]\d{9}$/;
        if (!phoneRegex.test(phone)) {
          return res.render("user/signup", {
          error: "Please enter a valid Phone Number",
        });
      }
    
      await User.findByIdAndUpdate(userId,{
        name:name.trim(),
        phone:phone?.trim()
      })

        return res.redirect("/profile");
      

    }catch(error){

        console.error("Error updating Profile:",error);
        return res.redirect("/profile");

    }
}