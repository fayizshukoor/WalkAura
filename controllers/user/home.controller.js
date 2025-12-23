

export const showHomePage = async(req,res)=>{
    try{
        return res.render("user/home");
    }catch(error){
        console.error("Error loading HomePage:",error);
        res.status(500).send("server Error");
    }
}