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
    users = {};

function userLoggedIn(user, socket) {
  if (users[user]) {// kick out old user
    users[user].emit('kickedout');
    users[user].disconnect(true);

    // notify
    delete users[user];
    for (var key in users) {
      users[key].emit('peer.disconnected', { id: user });
    }
  }

  // register user and notify
  setupListeners(socket);
  for (var key in users) {
    //if (key != user)
      users[key].emit('peer.connected', { id: user });
  }
  users[user] = socket;
  console.log('user loggedin', user);
};

function setupListeners(socket) {
  // setup listeners for login user
  socket.on('disconnect', function () {
    var disconnectedUser;
    for (var key in users) {
      if (users[key] === socket)
        disconnectedUser = key;
    }
    if (disconnectedUser) {
      delete users[disconnectedUser];
      for (var key in users) {
        users[key].emit('peer.disconnected', { id: disconnectedUser });
      }
      console.log('client disconnected:', socket.id);
    }
  });
  socket.on('reconnect', function () {
    console.log('reconnect ', socket.id);
  });
  socket.on('msg', function (data) {
    var toSocket = users[data.to];
    if (toSocket) {
      console.log('Redirecting message to', data.to, 'by', data.by, ' -- data type: ', data.type);
      toSocket.emit('msg', data);
    } else {
      console.warn('Invalid user');
    }
  });
}

function authenticateUser(id, pass){
  return (id && pass && config.USERS[id] == pass);
};

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
  var host = req.headers.host.replace(/(:\d+)$/, '');
  var httpsPort = ':' + httpsServer.address().port;
  httpsPort = httpsPort.replace(':443', '');
  res.redirect('https://' + host + httpsPort + req.url);
});
redirectApp.listen(80);
