const User = require("../models/user");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const router = require("./projectRoutes");
require("dotenv/config");
const checkAuth = require("../middleware/check-auth");
const { uploadFile, uploadToGCS } = require("../helper/upload");

let date = new Date();
date.setHours(date.getHours() + 7);

// Get All User
// http://localhost:3001/api/auth/get
router.get("/get", async (req, res) => {
  try {
    const response = await User.find().select(
      "_id name email pekerjaan avatar address phone status battery remote signal createdAt updatedAt"
    );

    res.json({
      status: "success",
      message: "data fetch successfully",
      count: response.length,
      data: response,
    });
  } catch (err) {
    res.json({
      status: "failed",
      message: "request error",
      error: err.message,
    });
  }
});

// Get By Id
// localhost:3001/api/auth/get/[userId]

router.get("/get/:userId", async (req, res) => {
  const { userId: id } = req.params;
  try {
    const response = await User.findOne({ _id: id }).select(
      "_id name pekerjaan avatar email address phone status battery remote signal createdAt updatedAt"
    );
    res.json({
      status: "success",
      message: "data fetch successfully",
      data: response,
    });
  } catch (err) {
    res.json({
      status: "failed",
      message: "request error",
      error: err.message,
    });
  }
});

// Load user login

router.get("/load", checkAuth, async (req, res) => {
  const { userId: id } = req.userData;
  try {
    const response = await User.findOne({
      _id: id,
    }).select(
      "_id name email pekerjaan address phone avatar status battery remote signal createdAt updatedAt"
    );

    res.json({
      status: "success",
      message: "data fetch successfully",
      data: response,
    });
  } catch (err) {
    res.json({
      status: "failed",
      message: "request error",
      error: err.message,
    });
  }
});

// Register
// localhot:3001/api/auth/register
router.post("/register", async (req, res) => {
  const {
    email,
    password,
    name,
    pekerjaan,
    gender,
    address,
    phone,
    status,
    battery,
    remote,
    signal,
  } = req.body;
  try {
    const checkExistedUser = await User.findOne({ email });

    if (checkExistedUser) {
      res.json({
        message: "Email exists",
      });
    }

    bcrypt.hash(password, 10, async (err, result) => {
      const newUser = new User({
        email,
        name,
        pekerjaan,
        address,
        gender,
        phone,
        password: result,
        status,
        battery,
        remote,
        signal,
      });
      try {
        const userCreated = await newUser.save();
        if (userCreated) {
          const token = jwt.sign(
            {
              email: userCreated.email,
              userId: userCreated._id,
            },
            process.env.JWT_KEY
          );

          res.json({
            status: "success",
            message: "User was created",
            token: token,
          });
        }
      } catch (err) {
        res.json({
          status: "failed",
          message: "request error",
          error: err.message,
        });
      }
    });
  } catch (err) {
    res.json({
      status: "failed",
      message: "request failed",
      error: err.message,
    });
  }
});

// Login
// localhost:3001/api/auth/login

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        status: "failed",
        message: "account not found",
      });
    }

    bcrypt.compare(password, user.password, (err, result) => {
      try {
        if (err) {
          res.json({
            status: "failed",
            message: "auth failed",
          });
          return;
        }

        if (result) {
          const token = jwt.sign(
            {
              email: user.email,
              userId: user._id,
            },
            process.env.JWT_KEY
          );

          return res.json({
            status: "success",
            message: "login successfully",
            token,
          });
        }

        return res.json({
          status: "failed",
          message: `password mismatch with email: ${email}`,
        });
      } catch (err) {
        res.json({
          status: "failed",
          message: "request failed",
          error: err.message,
        });
      }
    });
  } catch (err) {
    res.json({
      status: "failed",
      message: "request failed",
      error: err.message,
    });
  }
});

// Update
// localhost:3001/api/auth/update-user/:[userId]

router.patch(
  "/update-user",
  checkAuth,
  uploadFile([{ name: "avatar", maxCount: 1 }]),
  async (req, res) => {
    const { userId: id } = req.userData;
    try {
      const user = await User.findByIdAndUpdate(
        { _id: id },
        { new: true }
      ).select(
        "_id name email avatar pekerjaan address phone createdAt updatedAt"
      );

      // Check if existed project
      if (!user) {
        res.json({
          status: "failed",
          message: `data id: ${id} not found`,
        });
      }
      if (req.body.name) {
        user.name = req.body.name;
        user.updatedAt = date;
      }
      if (req.body.address) {
        user.address = req.body.address;
        user.updatedAt = date;
      }
      if (req.body.phone) {
        user.phone = req.body.phone;
        user.updatedAt = date;
      }
      if (req.body.pekerjaan) {
        user.pekerjaan = req.body.pekerjaan;
        user.updatedAt = date;
      }
      if (req.files.avatar) {
        user.avatar = await uploadToGCS(req.files.avatar);
        user.updatedAt = date;
      }
      const userUpdated = await user.save();

      // response
      res.json({
        status: "success",
        message: "data update successfully",
        data: userUpdated,
      });
    } catch (err) {
      res.json({
        status: "failed",
        message: "request failed",
        error: err.message,
      });
    }
  }
);

// Delete
// localhost:3001/api/auth/delete-user/[userId]
router.delete("/delete-user/:userId", checkAuth, async (req, res) => {
  const { userId: id } = req.params;
  try {
    const response = await User.deleteOne({ _id: id });
    console.log(response);
    if (response.n) {
      return res.json({
        status: "success",
        message: "data delete successfully",
        id: id,
      });
    } else {
      return res.json({
        status: "failed",
        message: `data id: ${id} not found`,
      });
    }
  } catch (err) {
    res.json({
      status: "failed",
      message: "request error",
      error: err.message,
    });
  }
});

module.exports = router;
