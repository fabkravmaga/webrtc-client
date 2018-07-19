var express = require('express'),
    expressApp = express(),
    socketio = require('socket.io'),
    http = require('http'),
    server = http.createServer(expressApp),
    uuid = require('node-uuid'),
    commonRoom = {},
    userIds = {};

//expressApp.use(express.static(__dirname + '/../public/dist/'));
expressApp.use(express.static(__dirname + '/../public/app/'));

exports.run = function (config) {

  server.listen(config.PORT);
  console.log('Listening on', config.PORT);
  socketio.listen(server, { log: false })
  .on('connection', function (socket) {

    var id;

    socket.on('init', function (data, fn) {
      fn('commonRoom', socket.id);
      for (var key in commonRoom) {
          commonRoom[key].emit('peer.connected', { id: socket.id });
      }
      commonRoom[socket.id] = socket;
      console.log('Peer connected to common room: ', socket.id);
      console.log('CommonRoom: ', commonRoom);
    });

    socket.on('msg', function (data) {
      var toSocket = commonRoom[data.to];
      if (toSocket) {
        console.log('Redirecting message to', data.to, 'by', data.by, ' -- data:', data);
        toSocket.emit('msg', data);
      } else {
        console.warn('Invalid user');
      }
    });

    socket.on('disconnect', function () {
      delete commonRoom[socket.id];
      for (var key in commonRoom) {
          commonRoom[key].emit('peer.disconnected', { id: socket.id });
      }
    });
  });
};
