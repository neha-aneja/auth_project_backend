const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const UserModel = require('./model/User');
const http = require('http');
const socketIO = require('socket.io');

dotenv.config();
const app = express();
app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000', // Replace with your frontend's URL
    credentials: true,
  })
);
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
  },
});

// Socket connection
io.on('connection', (socket) => {
  console.log('New client connected');

  socket.on('message', (data) => {
    io.emit('message', data); // Broadcast the message to all clients
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected');
  });
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => console.error('Failed to connect to MongoDB', err));

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
    }),
    cookie: { maxAge: 24 * 60 * 60 * 1000 }, // 1 day
  })
);

// app.listen(process.env.PORT, () => {
//   console.log(`Server is running on port ${process.env.PORT}`);
// });

server.listen(process.env.PORT, () =>
  console.log(`Server running on port ${process.env.PORT}`)
);

app.post('/signup', async (req, res) => {
  try {
    const { name, email, phoneNumber, role, password } = req.body;
    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new UserModel({
      name,
      email,
      phoneNumber,
      role,
      password: hashedPassword,
    });
    const savedUser = await newUser.save();
    res.status(201).json(savedUser);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await UserModel.findOne({ email });
    if (user) {
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        req.session.user = {
          id: user._id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phoneNumber,
          role: user.role,
        };
        res.json('Success');
      } else {
        res.status(401).json("Password doesn't match");
      }
    } else {
      res.status(404).json('No Records found');
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ error: 'Failed to logout' });
      } else {
        res.status(200).json('Logout successful');
      }
    });
  } else {
    res.status(400).json({ error: 'No session found' });
  }
});

app.get('/user', (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json('Not authenticated');
  }
});

app.get('/users', async (req, res) => {
  try {
    const getUsers = await UserModel.find({});
    res.status(201).send(getUsers);
  } catch (e) {
    res.status(400).send(e);
  }
});

app.get('/user/:id', async (req, res) => {
  try {
    const _id = req.params.id;
    const getUserById = await UserModel.findById({ _id: _id });
    res.status(201).send(getUserById);
  } catch (e) {
    res.status(400).send(e);
  }
});

app.patch('/user/:id', async (req, res) => {
  try {
    const _id = req.params.id;
    const updateUserById = await UserModel.findByIdAndUpdate(_id, req.body, {
      new: true,
    });
    res.status(201).send(updateUserById);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.delete('/user/:id', async (req, res) => {
  try {
    const _id = req.params.id;
    const deleteUserById = await UserModel.findByIdAndDelete(_id);
    res.status(201).send(deleteUserById);
  } catch (e) {
    res.status(500).send(e);
  }
});
