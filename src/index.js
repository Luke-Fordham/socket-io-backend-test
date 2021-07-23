const http = require("http");
const app = require("express")();
const {PrismaClient} = require('@prisma/client')
const prisma = new PrismaClient()

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


const PORT = 3001;

app.get('/get-all-users', async (req, res) => {
    let success = false;
    let error = null;
    let users = {};
    const result = await prisma.sb_user.findMany();
    if (result) {
        success = true;
        users = result;
    } else {
        error = 'No users found'
    }
    res.send({
        success,
        error,
        users
    })
})

io.use((socket, next) => {
    const username = socket.handshake.auth.username;
    const userId = socket.handshake.auth.userId;
    if (!username || !userId) {
        return next(new Error("invalid username/id"));
    }
    socket.username = username;
    socket.userId = userId;
    next();
});

const userList = [];

io.on("connection", async (socket) => {

    const conversations = await prisma.$queryRaw(
        `SELECT c.* FROM sb_conversation_member cm
                             LEFT JOIN sb_conversation c ON cm.conversation_id = c.id
                                WHERE cm.object_ref = 'sb_user'
                                AND cm.object_id = ${socket.userId}
                                `
    )

    console.log(conversations);


    socket.on("private message", ({content, to}) => {
        console.log({
            content,
            from: socket.userId,
        });
        socket.to(to).emit("private message", {
            content,
            from: socket.id,
        });
    });

    app.get('/get-single-user/:id', async (req, res) => {
        let success = false;
        let error = null;
        let user = {};
        if (req.params.id) {
            const result = await prisma.sb_user.findUnique({where: {id: req.params.id}});
            if (result) {
                success = true;
                user = result;
            } else {
                error = 'Could not find user with requested ID'
            }
        } else {
            error = 'user id required'
        }
        res.send({
            success,
            error,
            user
        })
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
