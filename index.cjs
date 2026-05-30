const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const sqlite3 = require("sqlite3").verbose();
const multer = require("multer");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database("./chat.db");

/* ======================
   LAST CHAT PREVIEW
====================== */

const lastChats = {};

/* ======================
   UPLOAD
====================== */

const storage = multer.diskStorage({

  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },

  filename: (req, file, cb) => {

    cb(
      null,
      Date.now() +
      path.extname(file.originalname)
    );

  }

});

const upload = multer({ storage });

app.use("/uploads", express.static("uploads"));

/* ======================
   DATABASE
====================== */

db.serialize(()=>{

  db.run(`
    CREATE TABLE IF NOT EXISTS messages(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roomId TEXT,
      sender TEXT,
      message TEXT,
      time TEXT,
      type TEXT
    )
  `);

});

/* ======================
   FRONTEND
====================== */

app.get("/", (req,res)=>{

  res.sendFile(__dirname + "/index.html");

});

/* ======================
   IMAGE UPLOAD
====================== */

app.post(
  "/upload",
  upload.single("image"),
  (req,res)=>{

    res.json({
      imageUrl:
      "/uploads/" +
      req.file.filename
    });

  }
);

/* ======================
   ONLINE USERS
====================== */

const onlineUsers = {};

/* ======================
   SOCKET
====================== */

io.on("connection", (socket)=>{

  console.log("connected");

  /* LOGIN */

  socket.on("login", (username)=>{

    socket.username = username;

    onlineUsers[username] = socket.id;

    io.emit(
      "onlineUsers",
      Object.keys(onlineUsers)
    );

    socket.emit(
      "lastChats",
      lastChats
    );

  });

  /* PRIVATE ROOM */

  socket.on(
    "joinPrivate",
    ({me,target})=>{

      const roomId =
      [me,target]
      .sort()
      .join("_");

      socket.join(roomId);

      socket.emit(
        "roomReady",
        {
          roomId,
          target
        }
      );

    }
  );

  /* SEND */

  socket.on(
    "sendMessage",
    (data)=>{

      const time =
      new Date()
      .toLocaleTimeString(
        [],
        {
          hour:"2-digit",
          minute:"2-digit"
        }
      );

      db.run(
        `
        INSERT INTO messages
        (
          roomId,
          sender,
          message,
          time,
          type
        )
        VALUES(?,?,?,?,?)
        `,
        [
          data.roomId,
          data.sender,
          data.message,
          time,
          data.type
        ]
      );

      const preview =
      data.type === "image"
      ? "📷 Foto"
      : data.message;

      lastChats[data.roomId] = {
        message: preview,
        time
      };

      io.emit(
        "chatPreviewUpdate",
        {
          roomId:data.roomId,
          message:preview,
          time
        }
      );

      io.to(data.roomId)
      .emit(
        "receiveMessage",
        {
          roomId:data.roomId,
          sender:data.sender,
          message:data.message,
          time,
          type:data.type
        }
      );

    }
  );

  /* HISTORY */

  socket.on(
    "loadMessages",
    (roomId)=>{

      db.all(
        `
        SELECT * FROM messages
        WHERE roomId = ?
        ORDER BY id ASC
        `,
        [roomId],
        (err,rows)=>{

          socket.emit(
            "messageHistory",
            rows
          );

        }
      );

    }
  );

  /* DISCONNECT */

  socket.on("disconnect", ()=>{

    delete onlineUsers[socket.username];

    io.emit(
      "onlineUsers",
      Object.keys(onlineUsers)
    );

  });

});

/* ======================
   START
====================== */

server.listen(3000, ()=>{

  console.log(
    "http://localhost:3000"
  );

});
