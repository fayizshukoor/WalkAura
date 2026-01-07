export const showAdminDashboard = (req,res)=>{
    return res.render("admin/dashboard",{layout:false});
}