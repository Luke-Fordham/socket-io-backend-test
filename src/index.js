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

app.get('/get-conversation/:id', async (req, res) => {
    let success = false;
    let error = null;
    let conversation = {};
    if (req.params.id) {
        const result = await prisma.sb_conversation.findUnique({where: {id: Number(req.params.id)}});
        result['members'] = await prisma.$queryRaw(
            `SELECT u.*
             FROM sb_conversation_member cm
                      LEFT JOIN sb_user u ON cm.object_id = u.id
             WHERE cm.conversation_id = ${result.id}
               AND cm.object_ref = 'sb_user'`
        )
        if (result) {
            success = true;
            conversation = result;
        } else {
            error = 'No conversation found'
        }
    } else {
        error = 'Conversation id needed'
    }
    res.send({
        success,
        error,
        conversation
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

io.on("connection", async (socket) => {

    const updateSocket = await prisma.sb_user.update({
        where: {
            id: socket.userId
        },
        data: {
            socket: socket.id
        }
    })

    const emitConversations = async (userId) => {
        const conversations = await prisma.$queryRaw(
            `SELECT c.*
             FROM sb_conversation_member cm
                      LEFT JOIN sb_conversation c ON cm.conversation_id = c.id
             WHERE cm.object_ref = 'sb_user'
               AND cm.object_id = ${userId}
            `
        )

        const fullConversation = conversations && conversations.length > 0 ? conversations.map(async (conv, index) => {
            const members = await prisma.$queryRaw(
                `SELECT u.*
                 FROM sb_conversation_member cm
                          LEFT JOIN sb_user u ON cm.object_id = u.id
                 WHERE cm.conversation_id = ${conv.id}
                   AND cm.object_ref = 'sb_user'`
            )
            conv['members'] = members ? members : [];
            return conv;
        }) : [];

        return await Promise.all(fullConversation);
    }

    socket.emit("conversations", await emitConversations(socket.userId));

    socket.on('join', (conversation) => {
        console.log('joining', conversation)
        socket.join(conversation);
    })

    socket.on("new conversation", () => {
        console.log(io.users);
    })

    socket.on('new conversation', async (conversation) => {
        if (conversation && conversation.members && conversation.members.length > 0) {
            const name = conversation.name ? conversation.name : conversation.members.toString();
            const newConversation = await prisma.sb_conversation.create({
                data: {
                    name: name,
                    description: conversation.description && conversation.description,
                    type_id: 1
                }
            })
            const newConversationMembers = await prisma.sb_conversation_member.createMany({
                data:[
                    {
                        conversation_id: newConversation.id,
                        object_ref: 'sb_user',
                        object_id: 1
                    },
                    {
                        conversation_id: newConversation.id,
                        object_ref: 'sb_user',
                        object_id: 2
                    }
                ]
            })
            if (newConversation && newConversationMembers) {
                console.log('new conversation');
                conversation.members.forEach(async member => {
                        const user = await prisma.sb_user.findUnique({
                            where: {
                                id: member
                            }
                        })
                        console.log(user)
                        if (user) {
                            socket.to(user.socket).emit("conversations", await emitConversations(user.id));
                            socket.emit("conversations", await emitConversations(user.id));
                            console.log(await emitConversations(user.id));
                        }
                    }
                )
            } else {
                socket.emit("error", {message: 'unable to create conversation'})
            }
        } else {
            socket.emit("error", {message: 'invalid request'})
        }
    })


    socket.on("private message", ({content, conversation}) => {
        console.log({
            content,
            from: socket.userId,
            to: conversation
        });
        socket.to(conversation).emit("private message", {
            content,
            from: socket.userId,
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
