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
app.use(express.urlencoded({ extended: true }));


// ==========================
// UPLOAD FOLDER
// ==========================
const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use("/uploads", express.static(uploadsPath));


// ==========================
// MONGODB
// ==========================
mongoose.connect(process.env.MONGO_URI)
.then(() => console.log("MongoDB Connected"))
.catch(err => console.log("MongoDB Error:", err));


// ==========================
// MULTER STORAGE (NO LOGIC CHANGE)
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
// FILE FILTER (KEEP SAME)
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
    } else {
        cb(null, false); // 🔥 FIX: prevent crash (IMPORTANT)
    }
};


// ==========================
// MULTER
// ==========================
const upload = multer({
    storage,
    fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 }
});


// ==========================
// SAFE ERROR HANDLER (FIX CONNECTION ISSUE)
// ==========================
app.use((err, req, res, next) => {

    console.log("SERVER ERROR:", err.message);

    return res.status(500).json({
        success: false,
        message: err.message || "Server error"
    });
});


// ==========================
// ROOT
// ==========================
app.get("/", (req, res) => {
    res.json({
        success: true,
        backend: "Amertak Backend",
        status: "online"
    });
});


// ==========================
// HEALTH
// ==========================
app.get("/health", (req, res) => {
    res.json({
        success: true,
        status: "healthy"
    });
});


// ==========================
// ADMIN LOGIN (KEEP LOGIC)
// ==========================
app.post("/admin-login", async (req, res) => {

    try {

        const { email, password } = req.body;

        if (!email || !password) {
            return res.json({
                success: false,
                message: "Missing fields"
            });
        }

        if (
            email !== process.env.ADMIN_EMAIL ||
            password !== process.env.ADMIN_PASSWORD
        ) {
            return res.json({
                success: false,
                message: "Invalid credentials"
            });
        }

        const token = jwt.sign(
            { email },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            success: true,
            token
        });

    } catch (err) {
        res.json({
            success: false,
            message: "Server error"
        });
    }
});


// ==========================
// SUBMIT ORDER (FIXED ONLY)
// ==========================
app.post(
    "/submit-order",
    upload.single("image"),
    async (req, res) => {

        try {

            const { username, rank } = req.body;

            // KEEP LOGIC
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

            // 🔥 FIX ONLY (prevent crash)
            if (!req.file) {
                return res.json({
                    success: false,
                    message: "Invoice required"
                });
            }

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

        } catch (err) {

            console.log(err);

            res.json({
                success: false,
                message: "Upload failed"
            });
        }

    }
);


// ==========================
// GET ORDERS (UNCHANGED)
// ==========================
const verifyToken = (req, res, next) => {

    try {

        const authHeader = req.headers.authorization;

        if (!authHeader) {
            return res.json({
                success: false,
                message: "No token"
            });
        }

        const token = authHeader.split(" ")[1];

        jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {

            if (err) {
                return res.json({
                    success: false,
                    message: "Invalid token"
                });
            }

            req.user = decoded;
            next();

        });

    } catch (err) {
        res.json({
            success: false,
            message: "Auth error"
        });
    }

};


app.get("/orders", verifyToken, async (req, res) => {

    try {

        const orders = await Order.find().sort({ createdAt: -1 });
        res.json(orders);

    } catch (err) {
        res.json([]);
    }

});


// ==========================
// UPDATE STATUS
// ==========================
app.post("/update-status", verifyToken, async (req, res) => {

    try {

        const { id, status } = req.body;

        if (!id || !status) {
            return res.json({
                success: false
            });
        }

        await Order.findByIdAndUpdate(id, { status });

        res.json({ success: true });

    } catch (err) {

        res.json({ success: false });

    }

});


// ==========================
// DELETE ORDER
// ==========================
app.delete("/delete-order/:id", verifyToken, async (req, res) => {

    try {

        const order = await Order.findById(req.params.id);

        if (order) {

            const imagePath = path.join(uploadsPath, order.image);

            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }

            await Order.findByIdAndDelete(req.params.id);
        }

        res.json({ success: true });

    } catch (err) {

        res.json({ success: false });

    }

});


// ==========================
// 404
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
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});