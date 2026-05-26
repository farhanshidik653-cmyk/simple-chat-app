const express = require('express');
const app = express();

const server = require('http').createServer(app);
const io = require('socket.io')(server);

const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./chat.db');

db.run(`
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT,
  text TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {

  console.log('User connected');

  socket.on('chat message', (msg) => {

    db.run(
      'INSERT INTO messages (user, text) VALUES (?, ?)',
      [msg.user, msg.text],
      (err) => {
        if (err) {
          console.error(err);
        }
      }
    );

    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected');
  });

});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
