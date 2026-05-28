require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const multer = require("multer");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const Order = require("./models/Order");

const app = express();



// ==========================
// MIDDLEWARE
// ==========================
app.use(cors());

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);



// ==========================
// UPLOADS FOLDER
// ==========================
const uploadsPath =
path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {

    fs.mkdirSync(uploadsPath, {
        recursive: true
    });

}



// ==========================
// STATIC FILES
// ==========================
app.use(
    "/uploads",
    express.static(uploadsPath)
);



// ==========================
// MONGODB CONNECT
// ==========================
mongoose.connect(process.env.MONGO_URI)

.then(() => {

    console.log("MongoDB Connected");

})

.catch((err) => {

    console.log("MongoDB Error:", err);

});



// ==========================
// STORAGE
// ==========================
const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, uploadsPath);

    },

    filename: (req, file, cb) => {

        const uniqueName =

            Date.now() +
            "-" +
            Math.floor(Math.random() * 999999) +
            path.extname(file.originalname);

        cb(null, uniqueName);

    }

});



// ==========================
// FILE FILTER
// ==========================
const fileFilter = (req, file, cb) => {

    const allowed = [

        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/webp"

    ];

    if (allowed.includes(file.mimetype)) {

        cb(null, true);

    }

    else {

        cb(
            new Error("Only image files allowed"),
            false
        );

    }

};



// ==========================
// MULTER
// ==========================
const upload = multer({

    storage,

    fileFilter,

    limits: {
        fileSize: 5 * 1024 * 1024
    }

});



// ==========================
// AUTH MIDDLEWARE
// ==========================
const verifyToken = (req, res, next) => {

    try {

        const authHeader =
        req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({

                success: false,
                message: "No token"

            });

        }

        const token =
        authHeader.split(" ")[1];

        jwt.verify(

            token,

            process.env.JWT_SECRET,

            (err, decoded) => {

                if (err) {

                    return res.status(403).json({

                        success: false,
                        message: "Invalid token"

                    });

                }

                req.user = decoded;

                next();

            }

        );

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: "Auth error"

        });

    }

};



// ==========================
// ROOT ROUTE
// ==========================
app.get("/", (req, res) => {

    res.json({

        success: true,
        backend: "Amertak Backend",
        status: "online"

    });

});



// ==========================
// HEALTH ROUTE
// ==========================
app.get("/health", (req, res) => {

    res.json({

        success: true,
        status: "healthy"

    });

});



// ==========================
// ADMIN LOGIN
// ==========================
app.post("/admin-login", async (req, res) => {

    try {

        const {

            email,
            password

        } = req.body;



        // ==========================
        // VALIDATION
        // ==========================
        if (!email || !password) {

            return res.json({

                success: false,
                message: "Missing fields"

            });

        }



        // ==========================
        // ADMIN CHECK
        // ==========================
        if (

            email !== process.env.ADMIN_EMAIL ||

            password !== process.env.ADMIN_PASSWORD

        ) {

            return res.json({

                success: false,
                message: "Invalid credentials"

            });

        }



        // ==========================
        // TOKEN
        // ==========================
        const token = jwt.sign(

            {
                email
            },

            process.env.JWT_SECRET,

            {
                expiresIn: "7d"
            }

        );



        res.json({

            success: true,
            token

        });

    }

    catch (err) {

        console.log(err);

        res.json({

            success: false,
            message: "Server error"

        });

    }

});



// ==========================
// SUBMIT ORDER
// ==========================
app.post(

    "/submit-order",

    upload.single("image"),

    async (req, res) => {

        try {

            const {

                username,
                rank

            } = req.body;



            // ==========================
            // VALIDATION
            // ==========================
            if (!username) {

                return res.json({

                    success: false,
                    message: "Username required"

                });

            }

            if (!rank) {

                return res.json({

                    success: false,
                    message: "Rank required"

                });

            }

            if (!req.file) {

                return res.json({

                    success: false,
                    message: "Invoice required"

                });

            }



            // ==========================
            // SAVE ORDER
            // ==========================
            const newOrder = new Order({

                username,

                rank,

                image: req.file.filename,

                status: "pending"

            });

            await newOrder.save();



            res.json({

                success: true,
                message: "Order submitted"

            });

        }

        catch (err) {

            console.log(err);

            res.json({

                success: false,
                message: "Upload failed"

            });

        }

    }

);



// ==========================
// GET ORDERS
// ==========================
app.get(

    "/orders",

    verifyToken,

    async (req, res) => {

        try {

            const orders =

            await Order.find()

            .sort({

                createdAt: -1

            });

            res.json(orders);

        }

        catch (err) {

            console.log(err);

            res.json([]);

        }

    }

);



// ==========================
// UPDATE STATUS
// ==========================
app.post(

    "/update-status",

    verifyToken,

    async (req, res) => {

        try {

            const {

                id,
                status

            } = req.body;



            if (!id || !status) {

                return res.json({

                    success: false,
                    message: "Missing fields"

                });

            }



            await Order.findByIdAndUpdate(

                id,

                {
                    status
                }

            );



            res.json({

                success: true

            });

        }

        catch (err) {

            console.log(err);

            res.json({

                success: false

            });

        }

    }

);



// ==========================
// DELETE ORDER
// ==========================
app.delete(

    "/delete-order/:id",

    verifyToken,

    async (req, res) => {

        try {

            const order =

            await Order.findById(
                req.params.id
            );



            if (order) {

                const imagePath =

                path.join(

                    uploadsPath,

                    order.image

                );



                if (fs.existsSync(imagePath)) {

                    fs.unlinkSync(imagePath);

                }



                await Order.findByIdAndDelete(

                    req.params.id

                );

            }



            res.json({

                success: true

            });

        }

        catch (err) {

            console.log(err);

            res.json({

                success: false

            });

        }

    }

);



// ==========================
// INVALID ROUTE
// ==========================
app.use((req, res) => {

    res.status(404).json({

        success: false,
        message: "Route not found"

    });

});



// ==========================
// START SERVER
// ==========================
const PORT =
process.env.PORT || 3000;

app.listen(PORT, () => {

    console.log(

        "Server running on port " +
        PORT

    );

});