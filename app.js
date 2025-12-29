    import dotenv from "dotenv";
    dotenv.config();
    import express from "express";
    import morgan from "morgan";
    import path from "path";
    import expressLayouts from "express-ejs-layouts";
    import { fileURLToPath } from "url";
    import cookieParser from "cookie-parser";
    import session from "express-session";
    import flash from "connect-flash";
    import userRoutes from "./routes/user.routes.js";
    import googleAuthRoutes from "./routes/google-auth.routes.js";
    import { userContext } from "./middlewares/userContext.middleware.js";
    import { authenticateUser } from "./middlewares/auth.middleware.js";
    import passport from "passport";
    import "./config/passport.js";

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);

    const app = express();

    app.use(morgan("dev"));

    app.use(express.json());
    app.use(express.urlencoded({extended:true}));

    app.use(cookieParser());

    app.use(session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: { 
            secure: false, // Set to true when using HTTPS
            httpOnly: true, 
            maxAge: 24 * 60 * 60 * 1000
        }
    }))

    app.use(flash());

    app.use(passport.initialize());

    app.use((req,res,next)=>{
        res.locals.success = req.flash("success");
        res.locals.error = req.flash("error");
        next();
    })

    app.use(express.static(path.join(__dirname,"public")))

    app.use(expressLayouts);

    app.set("view engine","ejs");
    app.set("views",path.join(__dirname,"views"))

    app.set("layout","layouts/user")

    app.use(authenticateUser);
    app.use(userContext);

    app.use("/",userRoutes);
    app.use("/auth",googleAuthRoutes);
    


    app.get("/",(req,res)=>{
        res.redirect("/home");
    })


   



    export default app;

