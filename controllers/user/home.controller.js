
export const landingPage = async(req,res)=>{
    try{
        return res.render("user/home");
    }catch(error){
        console.log("Error loading LandingPage");
        res.status(500).send("server Error");
    }
}


export const loadHomePage = async(req,res)=>{
    try{
        return res.render("user/home",{user:true});
    }catch(error){
        console.log("Error loading HomePage");
        res.status(500).send("server Error");
    }
}