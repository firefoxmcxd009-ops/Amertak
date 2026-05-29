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
// CORS — allow all origins
// ==========================
app.use(cors({
    origin: "*",
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"]
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



// ==========================
// UPLOADS FOLDER
// ==========================
const uploadsPath =
    path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use("/uploads", express.static(uploadsPath));



// ==========================
// MONGODB
// ==========================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.log("❌ Mongo Error:", err.message));



// ==========================
// MULTER — image upload
// ==========================
const storage = multer.diskStorage({

    destination: (req, file, cb) =>
        cb(null, uploadsPath),

    filename: (req, file, cb) => {
        const unique =
            Date.now() + "-" +
            Math.floor(Math.random() * 999999) +
            path.extname(file.originalname);
        cb(null, unique);
    }

});

// ✅ FIX: allow only images, max 5MB
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|gif|webp/;
        const ext = allowed.test(
            path.extname(file.originalname).toLowerCase()
        );
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            cb(null, true);
        } else {
            cb(new Error("Images only!"));
        }
    }
});



// ==========================
// VERIFY TOKEN MIDDLEWARE
// ==========================
const verifyToken = (req, res, next) => {

    const auth = req.headers.authorization;

    // ✅ FIX: was returning {success:false} without status code
    if (!auth) {
        return res.status(401).json({ success: false, message: "No token" });
    }

    const token = auth.split(" ")[1];

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(401).json({ success: false, message: "Invalid token" });
        }
        req.user = user;
        next();
    });

};



// ==========================
// POST /admin-login
// ==========================
app.post("/admin-login", (req, res) => {

    const { email, password } = req.body;

    if (
        email !== process.env.ADMIN_EMAIL ||
        password !== process.env.ADMIN_PASSWORD
    ) {
        return res.json({ success: false, message: "Wrong email or password" });
    }

    const token = jwt.sign(
        { email },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    res.json({ success: true, token });

});



// ==========================
// POST /submit-order
// ==========================
app.post("/submit-order", upload.single("image"), async (req, res) => {

    try {

        const { username, rank } = req.body;

        // ✅ FIX: validate all fields clearly
        if (!username) {
            return res.json({ success: false, message: "Username required" });
        }

        if (!rank) {
            return res.json({ success: false, message: "Rank required" });
        }

        if (!req.file) {
            return res.json({ success: false, message: "Invoice image required" });
        }

        const order = new Order({
            username,
            rank,
            image: req.file.filename,
            status: "pending"
        });

        await order.save();

        console.log("📦 New Order:", username, rank);

        res.json({ success: true, message: "Order submitted successfully!" });

    } catch (err) {

        console.error("submit-order error:", err.message);

        res.json({ success: false, message: err.message });

    }

});



// ==========================
// GET /orders  ← dashboard fetch
// ==========================
app.get("/orders", verifyToken, async (req, res) => {

    try {

        const orders = await Order
            .find()
            .sort({ createdAt: -1 });

        // ✅ FIX: was { success: true, orders: [...] }
        // dashboard does: orders.forEach(o => ...) — needs plain array
        res.json(orders);

    } catch (err) {

        console.error("orders error:", err.message);

        res.status(500).json({ success: false, message: err.message });

    }

});



// ==========================
// POST /update-status
// ==========================
app.post("/update-status", verifyToken, async (req, res) => {

    try {

        const { id, status } = req.body;

        // ✅ FIX: validate status value
        const allowed = ["pending", "approved", "rejected"];

        if (!allowed.includes(status)) {
            return res.json({ success: false, message: "Invalid status" });
        }

        await Order.findByIdAndUpdate(id, { status });

        res.json({ success: true });

    } catch (err) {

        console.error("update-status error:", err.message);

        res.json({ success: false, message: err.message });

    }

});



// ==========================
// DELETE /delete-order/:id
// ==========================
app.delete("/delete-order/:id", verifyToken, async (req, res) => {

    try {

        const order = await Order.findById(req.params.id);

        if (order) {

            // ✅ delete image file from disk too
            const file = path.join(uploadsPath, order.image);

            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                console.log("🗑️ Deleted file:", order.image);
            }

            await Order.findByIdAndDelete(req.params.id);

        }

        res.json({ success: true });

    } catch (err) {

        console.error("delete-order error:", err.message);

        res.json({ success: false, message: err.message });

    }

});



// ==========================
// MULTER ERROR HANDLER
// ==========================
app.use((err, req, res, next) => {

    if (err instanceof multer.MulterError || err) {

        console.error("Upload error:", err.message);

        return res.json({
            success: false,
            message: err.message || "Upload failed"
        });

    }

    next();

});



// ==========================
// START SERVER
// ==========================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});