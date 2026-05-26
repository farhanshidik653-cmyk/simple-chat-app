const onlineUsers = {};
const userSockets = {};

io.on("connection", (socket) => {

  // LOGIN
  socket.on("login", (username) => {
    socket.username = username;

    onlineUsers[username] = true;
    userSockets[username] = socket.id;

    socket.join(username); // 🔥 penting: private room per user

    io.emit("onlineUsers", Object.keys(onlineUsers));
  });

  // PRIVATE CHAT
  socket.on("sendMessage", ({ roomId, sender, message }) => {

    // kirim ke room
    io.to(roomId).emit("receiveMessage", {
      roomId,
      sender,
      message
    });
  });

  // GROUP CHAT FIXED
  socket.on("createGroup", ({ groupName, members }) => {

    const roomId = "group_" + Date.now();

    members.forEach(user => {
      const sid = userSockets[user];
      if (sid) {
        io.to(sid).socketsJoin(roomId);
      }
    });

    // broadcast group ke semua user
    io.emit("newGroup", {
      roomId,
      groupName,
      members
    });
  });

  socket.on("disconnect", () => {
    if (socket.username) {
      delete onlineUsers[socket.username];
      delete userSockets[socket.username];
    }

    io.emit("onlineUsers", Object.keys(onlineUsers));
  });
});
