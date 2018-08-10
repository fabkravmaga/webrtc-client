var config = require('./config/config.json');
//config.PORT = process.env.PORT || config.PORT;

var fs = require('fs');
var privateKey  = fs.readFileSync('./config/gdskey.pem', 'utf8');
var certificate = fs.readFileSync('./config/gdscert.pem', 'utf8');
var credentials = {key: privateKey, cert: certificate};

var express = require('express');
    expressApp = express();
    https = require('https'),
    httpsServer = https.createServer(credentials, expressApp);

// Enable reverse proxy support in Express. This causes the
// the "X-Forwarded-Proto" header field to be trusted so its
// value can be used to determine the protocol. See
// http://expressjs.com/api#app-settings for more details.
expressApp.enable('trust proxy');

/*
// Add a handler to inspect the req.secure flag (see
// http://expressjs.com/api#req.secure). This allows us
// to know whether the request was via http or https.
expressApp.use (function (req, res, next) {
  if (req.secure) {
    // request was via https, so do no special handling
    next();
  } else {
    // request was via http, so redirect to https
    res.redirect('https://' + req.headers.host + req.url);
  }
});
*/

//expressApp.use(express.static(__dirname + '/public/'));
expressApp.use(express.static('public'));
expressApp.use('/bower_components', express.static('bower_components'));

//var httpServer = expressApp.listen(config.PORT);
httpsServer.listen(443);
console.log('Listening on', 443);


var socketio = require('socket.io'),
    commonRoom = [],
    users = {};

function userLoggedIn(userId, socket) {
  if (users[userId]) {// kick out old user
    users[userId].socket.emit('kickedout');
    users[userId].socket.disconnect(true);

    // notify
    delete users[userId];
    if (commonRoom.indexOf(userId) >= 0) {
      commonRoom.splice(commonRoom.indexOf(userId), 1);
      commonRoom.forEach(id => {
        users[id].socket.emit('peer.left', { id:userId });
      });
    }
    for (var key in users) {
      users[key].socket.emit('peer.disconnected', { id: userId });
    }
  }

  // register user and notify
  setupListeners(socket);
  for (var key in users) {
    users[key].socket.emit('peer.connected', { id:userId, inCall:false });
  }
  users[userId] = {socket:socket, inCall:false};
  console.log('user loggedin', userId);
};

function setupListeners(socket) {
  // setup listeners for login user
  socket.on('disconnect', function () {
    var disconnectedUser = getUserId(socket);
    if (disconnectedUser) {
      delete users[disconnectedUser];
      if (commonRoom.indexOf(disconnectedUser) >= 0) {
        commonRoom.splice(commonRoom.indexOf(disconnectedUser), 1);
        commonRoom.forEach(id => {
          users[id].socket.emit('peer.left', { id:disconnectedUser });
        });
      }
      for (var key in users) {
        users[key].socket.emit('peer.disconnected', { id: disconnectedUser });
      }
      console.log('client disconnected:', socket.id);
    }
  });
  socket.on('msg', function (data) {
    var toSocket = users[data.to].socket;
    if (toSocket) {
      console.log('Redirecting message to', data.to, 'by', data.by, ' -- data type: ', data.type);
      toSocket.emit('msg', data);
    } else {
      console.warn('Invalid user');
    }
  });
  socket.on('joinCommonRoom', () => {
    var userId = getUserId(socket);
    if (userId && commonRoom.indexOf(userId) < 0) {
      console.log('Joined CommonRoom', userId);
      commonRoom.forEach(id => {
        users[id].socket.emit('peer.joined', { id:userId });
      });
      commonRoom.push(userId);
    }
  });
  socket.on('leaveCommonRoom', () => {
    var userId = getUserId(socket);
    if (userId && commonRoom.indexOf(userId) >= 0) {
      console.log('Left CommonRoom', userId);
      commonRoom.splice(commonRoom.indexOf(userId), 1);
      commonRoom.forEach(id => {
        users[id].socket.emit('peer.left', { id:userId });
      });
    }
  });
  /*
  socket.on('updateCallStatus', function (data) {
    var userId = getUserId(socket);
    if (userId) {
      users[userId].inCall = data.inCall ? true:false;
      for (var key in users) {
        if (key != userId)
          users[key].socket.emit('peer.updateCallStatus', { id:userId, inCall:users[userId].inCall });
      }
    }
  });
  socket.on('getOnlineUsers', function (fn) {
    var userId = getUserId(socket);
    var onlineUsers = getUsers();
    onlineUsers = onlineUsers.filter(user => user.id != userId);
    fn(onlineUsers);
  });
  */
}

function authenticateUser(id, pass){
  if (id && pass) {
    for (var key in config.USERS) {
      if (key.toLowerCase() == id.toLowerCase() && config.USERS[key] == pass)
        return true;
    }
  }
  return false;
};

function getUsers() {
  var onlineUsers = [];
  for (var key in users) {
    onlineUsers.push({id:key, inCall:users[key].inCall});
  }
  return onlineUsers;
}

function getUserId(socket) {
  for (var key in users) {
    if (users[key].socket === socket)
      return key;
  }
  return null;
}

socketio.listen(httpsServer, { log: false, pingInterval: 10000, pingTimeout: 5000 })
  .on('connection', function(socket){

    socket.on('login', function(data, fn){
      console.log("requested login: ", data)
      //check the auth data sent by the client
      if (authenticateUser(data.userId, data.userPass)) {
        fn(true);
        userLoggedIn(data.userId, socket);
      } else {
        fn(false);
      }
    });

  });

var redirectApp = express();
redirectApp.use (function (req, res, next) {
  var host = req.headers.host ? req.headers.host.replace(/(:\d+)$/, ''):req.headers.host;
  var httpsPort = ':' + httpsServer.address().port;
  httpsPort = httpsPort.replace(':443', '');
  res.redirect('https://' + host + httpsPort + req.url);
});
redirectApp.listen(80);
