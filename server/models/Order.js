const mongoose =
    require("mongoose");

const orderSchema =
    new mongoose.Schema({
        
        username: {
            type: String,
            required: true
        },
        
        rank: {
            type: String,
            required: true
        },
        
        image: {
            type: String,
            required: true
        },
        
        status: {
            type: String,
            default: "pending"
        },
        
        createdAt: {
            type: Date,
            default: Date.now
        }
        
    });

module.exports =
    mongoose.model(
        "Order",
        orderSchema
    );