// adminTokens.js
import jwt from "jsonwebtoken";

export const generateAdminAccessToken = (admin) => {
  return jwt.sign(
    {
      adminId: admin._id,
      role: "admin"
    },
    process.env.JWT_ADMIN_ACCESS_SECRET,
    {
      expiresIn: "10m"
    }
  );
};

export const generateAdminRefreshToken = (admin) => {
  return jwt.sign(
    {
      adminId: admin._id,
      role: "admin"
    },
    process.env.JWT_ADMIN_REFRESH_SECRET,
    {
      expiresIn: "1d"
    }
  );
};
