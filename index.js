var config = require('./config/config.json'),
    //server = require('./lib/server');
    server = require('./lib/common_room_server');
    // turn server
    turn = require('node-turn');

config.PORT = process.env.PORT || config.PORT;

server.run(config);

var turnServer = new turn({
  // set options
  listeningPort: 5555,
  authMech: 'long-term',
  /*
  credentials: {
    username: "password"
  }
  */
});
turnServer.start();
