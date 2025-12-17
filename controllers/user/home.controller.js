

export const showHomePage = async(req,res)=>{
    try{
        return res.render("user/home");
    }catch(error){
        console.log("Error loading HomePage");
        res.status(500).send("server Error");
    }
}