var express = require('express'),
    expressApp = express(),
    socketio = require('socket.io'),
    http = require('http'),
    server = http.createServer(expressApp),
    uuid = require('node-uuid'),
    rooms = {},
    userIds = {};

//expressApp.use(express.static(__dirname + '/../public/dist/'));
expressApp.use(express.static(__dirname + '/../public/app/'));

exports.run = function (config) {
  server.listen(config.PORT);

  console.log('Listening on', config.PORT);

  socketio.listen(server, { log: false})
  .on('connection', function (socket) {

    var currentRoom, id;
    socket.on('init', function (data, fn) {
      currentRoom = (data || {}).room || 4//uuid.v4();
      var room = rooms[currentRoom];
      if (!data) {
        rooms[currentRoom] = [socket];
        id = userIds[currentRoom] = 0;
        fn(currentRoom, id);
        console.log('Room created, with #', currentRoom);
      } else {
        if (!room) {
          return;
        }
        userIds[currentRoom] += 1;
        id = userIds[currentRoom];
        fn(currentRoom, id);
        room.forEach(function (s) {
          s.emit('peer.connected', { id: id });
        });
        room[id] = socket;
        console.log('Peer connected to room', currentRoom, 'with #', id);
      }
      console.log('init');
      console.log(rooms);
      console.log(currentRoom);
      console.log(id);
      console.log(data);
    });

    socket.on('msg', function (data) {
      console.log('msg');
      console.log(rooms);
      console.log(currentRoom);
      console.log(id);
      console.log(data);

      var to = parseInt(data.to, 10);
      if (rooms[currentRoom] && rooms[currentRoom][to]) {
        console.log('Redirecting message to', to, 'by', data.by);
        rooms[currentRoom][to].emit('msg', data);
      } else {
        console.warn('Invalid user');
      }
    });

    socket.on('disconnect', function () {
      console.log('disconnect');
      console.log(rooms);
      console.log(currentRoom);
      console.log(id);
      console.log(rooms[currentRoom][rooms[currentRoom].indexOf(socket)]);

      if (!currentRoom || !rooms[currentRoom]) {
        return;
      }
      delete rooms[currentRoom][rooms[currentRoom].indexOf(socket)];
      rooms[currentRoom].forEach(function (socket) {
        if (socket) {
          socket.emit('peer.disconnected', { id: id });
        }
      });

      console.log('disconnect after');
      console.log(rooms);
      console.log(currentRoom);
      console.log(id);
    });
  });
};
