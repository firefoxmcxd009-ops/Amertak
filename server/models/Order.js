const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        trim: true
    },

    rank: {
        type: String,
        required: true,
        // ✅ FIX: validate allowed rank values
        enum: ["vip", "mvp", "mvpplus", "epic", "kingdom"]
    },

    image: {
        type: String,
        required: true
    },

    status: {
        type: String,
        default: "pending",
        enum: ["pending", "approved", "rejected"]
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

module.exports = mongoose.model("Order", orderSchema);
