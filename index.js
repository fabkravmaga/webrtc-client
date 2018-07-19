var config = require('./config/config.json'),
    //server = require('./lib/server');
    server = require('./lib/common_room_server');

config.PORT = process.env.PORT || config.PORT;

server.run(config);
