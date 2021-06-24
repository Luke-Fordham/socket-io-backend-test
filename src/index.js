const http = require("http");
const app = require("express")();

const server = http.createServer(app);
const io = require("socket.io")(server, {
  cors: {
    origin: 'http://localhost:3000'
  }

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

io.on("connection", (socket) => {
  const users = [];
  for (let [id, socket] of io.of("/").sockets) {
    users.push({
      userID: id,
      username: socket.username,
    });
  }
  socket.emit("users", users);
  // notify existing users
  socket.broadcast.emit("user connected", {
    userID: socket.userID,
    username: socket.username,
    connected: true,
    messages: [],
  });

  socket.on("private message", ({ content, to }) => {
    socket.to(to).emit("private message", {
      content,
      from: socket.id,
    });
  });
});

// const UNIQUE_CLIENTS = true;
//
// // 1. Socket Map
//
// const subscribers = new Map();
//
// const subscribe = (id, socket) => {
//   if (UNIQUE_CLIENTS && subscribers.has(id)) {
//     console.log(
//       `Client with ID ${id} already connected. Disconnecting older client.`
//     );
//     unsubscribe(id);
//   }
//
//   subscribers.set(id, socket);
//   console.log(`Connected to ${id}.`);
// };
//
// const unsubscribe = id => {
//   subscribers.delete(id);
//   console.log(`Disconnected from ${id}.`);
// };
//
// const notifySubscribers = data => {
//   subscribers.forEach(socket => socket.emit("action", data));
// };
//
// // 2. Socket Host
//
// io.on("connection", socket => {
//   const id = socket.handshake.headers.origin;
//
//   subscribe(id, socket);
//
//   socket.on("action", data => {
//     notifySubscribers(data);
//   });
//
//   socket.on("disconnect", () => {
//     unsubscribe(id);
//   });
// });

// 3. Start the server
server.listen(PORT, () =>
  console.log(`
👋
Server started
Socket host is listening for connections.
`)
);
