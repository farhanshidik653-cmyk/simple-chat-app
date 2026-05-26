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
      room TEXT,
      sender TEXT,
      message TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
});

/* =========================
   STATE
========================= */
const onlineUsers = {};   // username -> socket.id
const rooms = {};         // roomId -> { type, members, name }

/* =========================
   SOCKET
========================= */
io.on("connection", (socket) => {
  console.log("connected:", socket.id);

  // LOGIN USER
  socket.on("login", (username) => {
    socket.username = username;
    onlineUsers[username] = socket.id;

    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  // CREATE GROUP
  socket.on("createGroup", ({ groupName, members }) => {
    const roomId = "group_" + Date.now();

    rooms[roomId] = {
      type: "group",
      name: groupName,
      members
    };

    // join semua member ke room
    members.forEach(user => {
      const sid = onlineUsers[user];
      if (sid) {
        io.sockets.sockets.get(sid)?.join(roomId);
      }
    });

    io.emit("newGroup", { roomId, groupName, members });
  });

  // JOIN PRIVATE
  socket.on("joinPrivate", (roomId) => {
    socket.join(roomId);
  });

  // MESSAGE (PRIVATE + GROUP)
  socket.on("sendMessage", ({ roomId, sender, message }) => {

    db.run(
      `INSERT INTO messages (room, sender, message)
       VALUES (?, ?, ?)`,
      [roomId, sender, message]
    );

    io.to(roomId).emit("receiveMessage", {
      roomId,
      sender,
      message
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const user = socket.username;
    if (user) delete onlineUsers[user];

    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});

/* =========================
   HISTORY
========================= */
app.get("/messages/:roomId", (req, res) => {
  db.all(
    "SELECT * FROM messages WHERE room = ? ORDER BY createdAt ASC",
    [req.params.roomId],
    (err, rows) => {
      if (err) return res.status(500).send(err);
      res.json(rows);
    }
  );
});

/* =========================
   START
========================= */
server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
