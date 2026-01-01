import jwt from "jsonwebtoken";

export const requireAdmin = (req, res, next) => {
  const token = req.cookies.adminToken;

  if (!token) {
    return res.redirect("/admin");
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (decoded.role !== "admin") {
      return res.redirect("/admin");
    }

    req.admin = decoded;
    next();

  } catch (error) {
    return res.redirect("/admin");
  }
};
