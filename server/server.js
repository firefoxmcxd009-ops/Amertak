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

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================
// UPLOAD FIX
// ==========================
const uploadsPath = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsPath)) {
    fs.mkdirSync(uploadsPath, { recursive: true });
}

app.use("/uploads", express.static(uploadsPath));

// ==========================
// MONGO
// ==========================
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.log("Mongo Error:", err.message));

// ==========================
// MULTER
// ==========================
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsPath),
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + Math.floor(Math.random() * 999999) + path.extname(file.originalname));
    }
});

const upload = multer({ storage });

// ==========================
// ADMIN LOGIN
// ==========================
app.post("/admin-login", (req, res) => {
    const { email, password } = req.body;
    
    if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
        return res.json({ success: false, message: "Wrong login" });
    }
    
    const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: "7d" });
    
    res.json({ success: true, token });
});

// ==========================
// SUBMIT ORDER
// ==========================
app.post("/submit-order", upload.single("image"), async (req, res) => {
    try {
        
        const { username, rank } = req.body;
        
        if (!username) return res.json({ success: false, message: "Username required" });
        if (!rank) return res.json({ success: false, message: "Rank required" });
        if (!req.file) return res.json({ success: false, message: "Upload invoice required" });
        
        const order = new Order({
            username,
            rank,
            image: req.file.filename,
            status: "pending"
        });
        
        await order.save();
        
        res.json({ success: true, message: "Order saved" });
        
    } catch (err) {
        console.log(err);
        res.json({ success: false, message: err.message });
    }
});

// ==========================
// AUTH
// ==========================
const verifyToken = (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.json({ success: false });
    
    const token = auth.split(" ")[1];
    
    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.json({ success: false });
        req.user = user;
        next();
    });
};

// ==========================
// GET ORDERS
// ==========================
app.get("/orders", verifyToken, async (req, res) => {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json({ success: true, orders });
});

// ==========================
// UPDATE
// ==========================
app.post("/update-status", verifyToken, async (req, res) => {
    const { id, status } = req.body;
    await Order.findByIdAndUpdate(id, { status });
    res.json({ success: true });
});

// ==========================
// DELETE
// ==========================
app.delete("/delete-order/:id", verifyToken, async (req, res) => {
    const order = await Order.findById(req.params.id);
    
    if (order) {
        const file = path.join(uploadsPath, order.image);
        if (fs.existsSync(file)) fs.unlinkSync(file);
        
        await Order.findByIdAndDelete(req.params.id);
    }
    
    res.json({ success: true });
});

// ==========================
app.listen(process.env.PORT || 3000, () => {
    console.log("Server running");
});