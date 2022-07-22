const {createServer} = require('http')
const {Server} = require('socket.io')
const nicknamer = require('nicknamer');
const path = require('path');
const fs = require('fs')

var nStatic = require('node-static');
var fileServer = new nStatic.Server('./dist');

const httpServer = createServer(function (req, res) {
    fileServer.serve(req, res);
});

const io = new Server(httpServer, {
  cors: { origin: "*" }
});

const people = {}

function generatePeerId() {
    const name = nicknamer.get().split(' ').join('')
    const salt = Math.floor(Math.random() * 100)
    return `${name}${salt.toLocaleString('en-us', { minimumIntegerDigits: 2 })}`
}

function broadcastPeopleList(socket) {
    const peopleList = Object.keys(people).map(k => people[k])
    socket.broadcast.emit('online', peopleList)
    socket.emit('online', peopleList)
    console.log(people);
}

function getSocketId(peer) {
    return Object.keys(people).find(k => people[k] === peer)
}

io.on('connection', socket => {
    console.log(`User connected! ${socket.id}`);
    
    const peerId = generatePeerId()
    people[socket.id] = peerId
    
    socket.emit('hello', peerId)
    
    broadcastPeopleList(socket)

    socket.on('offer', offer => {
        const callerPeer = people[socket.id];
        const calleePeer = offer.peer;
        console.log(`New offer from ${callerPeer} to ${calleePeer}`);
        const id = getSocketId(calleePeer)
        socket.to(id).emit('offer', {
            ...offer,
            peer: callerPeer
        })
    })

    socket.on('answer', answer => {
        const calleePeer = people[socket.id]
        const callerPeer = answer.peer
        const id = getSocketId(callerPeer)
        if (!answer.answer) {
            socket.to(id).emit('answer', answer)
            console.log(`${calleePeer} accepted offer from ${callerPeer}`);
        } else {
            socket.to(id).emit('answer', false)
            console.log(`${calleePeer} rejected offer from ${callerPeer}`);
        }
    })

    socket.on('offerCandidate', oc => {
        const callerPeer = people[socket.id];
        const calleePeer = oc.peer;
        console.log(`Received offer candidate from ${callerPeer} to ${calleePeer}`);
        const id = getSocketId(calleePeer)
        socket.to(id).emit(oc.candidate)
    })

    socket.on('answerCandidate', oc => {
        const callerPeer = people[socket.id];
        const calleePeer = oc.peer;
        console.log(`Received answer candidate from ${callerPeer} to ${calleePeer}`);
        const id = getSocketId(calleePeer)
        socket.to(id).emit(oc.candidate)
    })

    socket.on('close', toPeer => {
        const fromPeer = people[socket.id]
        const id = getSocketId(toPeer)
        socket.to(id).emit('close')
        socket.emit('close')
        console.log(`${fromPeer}-${toPeer} call closed by ${fromPeer}`);
    })

    socket.on('online', () => broadcastPeopleList(socket))

    socket.on('disconnect', () => {
        console.log(`User disconnected ${socket.id}`);

        delete people[socket.id]
        broadcastPeopleList(socket)
    })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
    console.log(`Server is started on port ${5000}`);
})