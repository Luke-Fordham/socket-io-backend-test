var http = require("http");
var app = require("express")();

var server = http.createServer(app);
var io = require("socket.io")(server);

var PORT = 8080;
var UNIQUE_CLIENTS = true;

// 1. Socket Map

const subscribers = new Map();

const subscribe = (id, socket) => {
  if (UNIQUE_CLIENTS && subscribers.has(id)) {
    console.log(
      `Client with ID ${id} already connected. Disconnecting older client.`
    );
    unsubscribe(id);
  }

  subscribers.set(id, socket);
  console.log(`Connected to ${id}.`);
};

const unsubscribe = id => {
  subscribers.delete(id);
  console.log(`Disconnected from ${id}.`);
};

const notifySubscribers = data => {
  subscribers.forEach(socket => socket.emit("action", data));
};

// 2. Socket Host

io.on("connection", socket => {
  const id = socket.handshake.headers.origin;

  subscribe(id, socket);

  socket.on("action", data => {
    notifySubscribers(data);
  });

  socket.on("disconnect", () => {
    unsubscribe(id);
  });
});

// 3. Start the server
server.listen(PORT, () =>
  console.log(`
👋
Server started
Socket host is listening for connections.
`)
);

// 4. Deliver index.html at the server's public URL.
app.get("/", (req, res) => {
  res.sendFile("index.html", { root: __dirname });
});
