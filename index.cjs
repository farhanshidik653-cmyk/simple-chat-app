const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database("./chat.db");

app.use(express.json());

/* =========================
   FRONTEND
========================= */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/* =========================
   DB INIT
========================= */
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender TEXT,
      receiver TEXT,
      room TEXT,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* =========================
   ONLINE USERS STORAGE
========================= */
const onlineUsers = {}; // { username: socket.id }

/* =========================
   SOCKET.IO
========================= */
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // LOGIN USER
  socket.on("login", (username) => {
    socket.username = username;
    onlineUsers[username] = socket.id;

    io.emit("updateOnlineUsers", Object.keys(onlineUsers));
  });

  // PRIVATE CHAT ROOM
  socket.on("joinPrivate", (roomId) => {
    socket.join(roomId);
  });

  // SEND MESSAGE
  socket.on("privateMessage", (data) => {
    const { sender, receiver, message } = data;

    const roomId = createRoomId(sender, receiver);

    db.run(
      `INSERT INTO messages (sender, receiver, room, message)
       VALUES (?, ?, ?, ?)`,
      [sender, receiver, roomId, message]
    );

    io.to(roomId).emit("receiveMessage", {
      sender,
      receiver,
      message,
      room: roomId
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const username = socket.username;

    if (username && onlineUsers[username]) {
      delete onlineUsers[username];
      io.emit("updateOnlineUsers", Object.keys(onlineUsers));
    }

    console.log("User disconnected:", socket.id);
  });
});

/* =========================
   HISTORY CHAT
========================= */
app.get("/messages/:roomId", (req, res) => {
  const roomId = req.params.roomId;

  db.all(
    "SELECT * FROM messages WHERE room = ? ORDER BY createdAt ASC",
    [roomId],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});

/* =========================
   ROOM ID
========================= */
function createRoomId(a, b) {
  return [a, b].sort().join("_");
}

/* =========================
   START SERVER
========================= */
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
