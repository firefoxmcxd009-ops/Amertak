require("dotenv").config();

const express =
require("express");

const mongoose =
require("mongoose");

const multer =
require("multer");

const cors =
require("cors");

const jwt =
require("jsonwebtoken");

const path =
require("path");

const fs =
require("fs");

const Order =
require("./models/Order");

const app =
express();



// ==========================
// MIDDLEWARE
// ==========================
app.use(cors());

app.use(express.json());

app.use(express.urlencoded({
    extended:true
}));



// ==========================
// UPLOADS FOLDER
// ==========================
if(
!fs.existsSync("uploads")
){

    fs.mkdirSync(
    "uploads"
    );

}



// ==========================
// STATIC UPLOADS
// ==========================
app.use(

"/uploads",

express.static(

path.join(
__dirname,
"uploads"
)

)

);



// ==========================
// MONGODB
// ==========================
mongoose.connect(

process.env.MONGO_URI,

{
    useNewUrlParser:true,
    useUnifiedTopology:true
}

)

.then(()=>{

    console.log(
    "MongoDB Connected"
    );

})

.catch((err)=>{

    console.log(err);

});



// ==========================
// STORAGE
// ==========================
const storage =
multer.diskStorage({

    destination:
    (req,file,cb)=>{

        cb(
        null,
        "uploads/"
        );

    },

    filename:
    (req,file,cb)=>{

        const uniqueName =

        Date.now() +
        "-" +
        Math.floor(
        Math.random() * 999999
        ) +
        path.extname(
        file.originalname
        );

        cb(
        null,
        uniqueName
        );

    }

});



// ==========================
// FILE FILTER
// ==========================
const fileFilter =
(req,file,cb)=>{

    const allowed = [

        "image/png",

        "image/jpeg",

        "image/jpg",

        "image/webp"

    ];

    if(
    allowed.includes(
    file.mimetype
    )
    ){

        cb(null,true);

    }

    else{

        cb(

        new Error(
        "Only image files allowed"
        ),

        false

        );

    }

};



// ==========================
// MULTER
// ==========================
const upload =
multer({

    storage,

    fileFilter,

    limits:{
        fileSize:
        5 * 1024 * 1024
    }

});



// ==========================
// ADMIN LOGIN
// ==========================
app.post(

"/admin-login",

async(req,res)=>{

    try{

        const {

            email,
            password

        } = req.body;



        // ==========================
        // PASSWORD CHECK
        // ==========================
        if(

        password !==
        "@amertakAdmin123"

        ){

            return res.json({

                success:false,

                message:
                "Wrong password"

            });

        }



        // ==========================
        // TOKEN
        // ==========================
        const token =
        jwt.sign(

            {
                email
            },

            process.env.JWT_SECRET,

            {
                expiresIn:"7d"
            }

        );



        res.json({

            success:true,

            token

        });

    }

    catch(err){

        console.log(err);

        res.json({

            success:false,

            message:
            "Server Error"

        });

    }

});



// ==========================
// SUBMIT ORDER
// ==========================
app.post(

"/submit-order",

upload.single("image"),

async(req,res)=>{

    try{

        // ==========================
        // VALIDATION
        // ==========================
        if(
        !req.body.username
        ){

            return res.json({

                success:false,

                message:
                "Username required"

            });

        }

        if(
        !req.body.rank
        ){

            return res.json({

                success:false,

                message:
                "Rank required"

            });

        }

        if(
        !req.file
        ){

            return res.json({

                success:false,

                message:
                "Invoice required"

            });

        }



        // ==========================
        // SAVE ORDER
        // ==========================
        const newOrder =
        new Order({

            username:
            req.body.username,

            rank:
            req.body.rank,

            image:
            req.file.filename,

            status:
            "pending"

        });

        await newOrder.save();



        res.json({

            success:true,

            message:
            "Order submitted"

        });

    }

    catch(err){

        console.log(err);

        res.json({

            success:false,

            message:
            "Upload failed"

        });

    }

});



// ==========================
// GET ORDERS
// ==========================
app.get(

"/orders",

async(req,res)=>{

    try{

        const orders =
        await Order.find()

        .sort({

            createdAt:-1

        });

        res.json(
        orders
        );

    }

    catch(err){

        console.log(err);

        res.json([]);

    }

});



// ==========================
// UPDATE STATUS
// ==========================
app.post(

"/update-status",

async(req,res)=>{

    try{

        const {

            id,
            status

        } = req.body;



        await Order.findByIdAndUpdate(

            id,

            {
                status
            }

        );



        res.json({

            success:true

        });

    }

    catch(err){

        console.log(err);

        res.json({

            success:false

        });

    }

});



// ==========================
// DELETE ORDER
// ==========================
app.delete(

"/delete-order/:id",

async(req,res)=>{

    try{

        const order =
        await Order.findById(
        req.params.id
        );



        if(order){

            const imagePath =

            path.join(

                __dirname,

                "uploads",

                order.image

            );



            if(
            fs.existsSync(
            imagePath
            )
            ){

                fs.unlinkSync(
                imagePath
                );

            }



            await Order.findByIdAndDelete(
            req.params.id
            );

        }



        res.json({

            success:true

        });

    }

    catch(err){

        console.log(err);

        res.json({

            success:false

        });

    }

});



// ==========================
// START SERVER
// ==========================
const PORT =
process.env.PORT || 3000;

app.listen(PORT,()=>{

    console.log(

    "Server running on port " +
    PORT

    );

});