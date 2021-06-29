const http = require("http");
const app = require("express")();

const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: 'http://localhost:3000'
  }

});

// Enable CORS for all HTTP methods
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, PUT, POST, DELETE, OPTIONS");
  res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});


const PORT = 8080;

io.use((socket, next) => {
  const username = socket.handshake.auth.username;
  if (!username) {
    return next(new Error("invalid username"));
  }
  socket.username = username;
  next();
});

const userList = [];

io.on("connection", (socket) => {
  const users = [];

  for (let [id, socket] of io.of("/").sockets) {
    users.push({
      userID: id,
      username: socket.username,
      messages: [],
      connected: true
    });
  }
  socket.emit("users", users);
  // notify existing users
  socket.broadcast.emit("user connected", {
    userID: socket.id,
    username: socket.username,
    connected: true,
    messages: [],
  });

  userList.push({
    userID: socket.id,
    username: socket.username,
    connected: true,
    messages: [],
  });

  socket.on("private message", ({ content, to }) => {
    console.log({
      content,
      from: socket.id,
    });
    socket.to(to).emit("private message", {
      content,
      from: socket.id,
    });
  });

  app.get('/get-single-user/:id', (req, res) => {
    if (req.params.id) {
      let success = false;
      let error = null;
      let user = {};
      const result = userList.find(user => user.userID === req.params.id);
      if (result) {
        success = true;
        user = result;
      } else {
        error = 'Could not find user with requested ID'
      }
      res.send({
        success,
        error,
        user
      })
    }
  })
});


// 3. Start the server
server.listen(PORT, () =>
  console.log(`
👋
Server started
Socket host is listening for connections.
`)
);
