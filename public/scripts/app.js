'use strict';

/*
Object.setPrototypeOf = Object.setPrototypeOf || function(obj, proto) {
  obj.__proto__ = proto;
  return obj;
};
*/


angular.module('webrtcApp', ['ngSanitize']).run(function($rootScope, $timeout, config){
  $rootScope.loginNeeded = false;
  $rootScope.fatalErr = '';
  $rootScope.peers = [];
  $rootScope.loggedIn = false,

  // get webcam first then continue
  // no webcam then no point
  navigator.mediaDevices.getUserMedia({
    audio: true,
    video: {
      width: {ideal:1920},
      height: {ideal:1080}
    }
  }).then(function(stream){
    $('#localStream')[0].srcObject = stream;
    $rootScope.localStream = stream;
    $timeout(function(){
      continueSetup();
    }, 500);
  }).catch(function(error){
    $rootScope.fatalErr = 'No audio/video permissions. Please refresh your browser and allow the audio/video capturing.';
  });



  var iceConfig = { 'iceServers': [
                                    { 'urls': 'stun:digitalportal.gdshive.com:3478' },
                                    {
                                      'urls': 'turn:digitalportal.gdshive.com:3478?transport=udp',
                                      username: 'gdswebrtc',
                                      credential: 'password'
                                    },
                                    /*
                                    { 'urls': 'stun:stun.l.google.com:19302' },
                                    { 'urls': 'stun:13.250.85.233:3478' },
                                    {
                                      'urls': 'turn:13.250.85.233:3478?transport=udp',
                                      username: 'gdswebrtc',
                                      credential: 'password'
                                    }
                                    */
                                  ],
                    //iceTransportPolicy: 'relay'
                  },
      peerConnections = {},
      currentId,
      mainSocket;

  function continueSetup() {
    //setup socket
    mainSocket = io.connect();//config.SIGNALIG_SERVER_URL);
    mainSocket.on('kickedout', function () {
      console.log('server kicked us out!');
      localStorage.removeItem('webrtcApp_UserId');
      localStorage.removeItem('webrtcApp_UserPass');
      $rootScope.fatalErr = 'Got kicked out by server (Someone might have logged in using same user ID). Webrtc Application closed.';
      if ($rootScope.localStream) {
        $rootScope.localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    });

    mainSocket.on('disconnect', function (reason) {
      // clean up peer connections
      for (var key in peerConnections) {
        peerConnections[key].close();
      }
      peerConnections = {};
      $rootScope.peers = [];
      $rootScope.$digest();
    });

    mainSocket.on('reconnect', function () {
      console.log('server reconnected! ');
      if ($rootScope.loggedIn) {
        // reconnecting after connection broked. have to re-login
        mainSocket.emit('login', { userId: $rootScope.userId, userPass: $rootScope.userPass }, function(success){
          if (success) {
            $rootScope.currentSocketId = mainSocket.id;
          } else {
            // TODO: err. re-login failed. need to open login form or throw fatalerr.
            $rootScope.fatalErr = 'Unable to re-login after re-establishing connection to server.';
          }
        });
      }
    });

    mainSocket.on('msg', function (data) {
      handleMessage(data);
    });
    mainSocket.on('peer.connected', function (data) {
      console.log('peer.connected: ', data);
      makeOffer(data.id);
    });
    mainSocket.on('peer.disconnected', function (data) {
      console.log('peer.disconnected: ', data);
      if (peerConnections[data.id]) {
        peerConnections[data.id].close();
        delete peerConnections[data.id];
      }
      console.log('Peer disconnected, removing stream');
      $rootScope.peers = $rootScope.peers.filter(function (p) {
        return p.id !== data.id;
      });
      $rootScope.$digest();
    });

    $rootScope.requestLogin = function(id, pass, callback) {
      $rootScope.loggedIn = false;
      localStorage.removeItem('webrtcApp_UserId');
      localStorage.removeItem('webrtcApp_UserPass');
      mainSocket.emit('login', { userId: id, userPass: pass }, function(success){
        if (success) {
          $rootScope.userId = id;
          $rootScope.userPass = pass;
          $rootScope.currentSocketId = mainSocket.id;
          $rootScope.loggedIn = true;
          // setup localStorage
          localStorage.setItem('webrtcApp_UserId', id);
          localStorage.setItem('webrtcApp_UserPass', pass);
          $rootScope.$digest();
        }
        callback(success);
      });
    };

    // TODO:try to do login from local storage/cookie first.
    // activate login form

    //var storageUserId, storageUserPass;
    var storageUserId = localStorage.getItem('webrtcApp_UserId');
    var storageUserPass = localStorage.getItem('webrtcApp_UserPass');
    if (storageUserId && storageUserPass) {
      // attempt to login using localStorage
      console.log('attempt login from localStorage: ', storageUserId);
      $rootScope.requestLogin(storageUserId, storageUserPass, (success) => {
        if (!success) {
          $rootScope.loginNeeded = true;
          $($('.login input')[0]).focus(); //set focus to user id input
        }
      });
    } else {
      $rootScope.loginNeeded = true;
      $($('.login input')[0]).focus(); //set focus to user id input
    }
  };


  function getPeerConnection(id) {
    if (peerConnections[id]) {
      return peerConnections[id];
    }
    var pc = new RTCPeerConnection(iceConfig);
    peerConnections[id] = pc;
    pc.addStream($rootScope.localStream);
    pc.onicecandidate = function (evnt) {
      console.log('Send ice to ', id);
      mainSocket.emit('msg', { by: $rootScope.userId, to: id, ice: evnt.candidate, type: 'ice' });
    };
    pc.onaddstream = function (evnt) {
      console.log('Received new stream');
      $rootScope.peers.push({
        id: id,
        stream: evnt.stream
      });
      $rootScope.$digest();
    };
    return pc;
  }

  function makeOffer(id) {
    var pc = getPeerConnection(id);
    pc.createOffer(function (sdp) {
      pc.setLocalDescription(sdp);
      console.log('Creating an offer for', id);
      mainSocket.emit('msg', { by: $rootScope.userId, to: id, sdp: sdp, type: 'sdp-offer' });
    }, function (e) {
      console.log(e);
    });
    //},
    //{ mandatory: { offerToReceiveVideo: true, offerToReceiveAudio: true }});
  };

  function handleMessage(data) {
    var pc = getPeerConnection(data.by);
    switch (data.type) {
      case 'sdp-offer':
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
          console.log('Setting remote description by offer');
          pc.createAnswer(function (sdp) {
            pc.setLocalDescription(sdp);
            console.log('Received offer by ', data.by);
            console.log('Sending answer to ', data.by);
            mainSocket.emit('msg', { by: $rootScope.userId, to: data.by, sdp: sdp, type: 'sdp-answer' });
          }, function (e) {
            console.log(e);
          });
        }, function (e) {
          console.log(e);
        });
        break;
      case 'sdp-answer':
        console.log('Received answer by ', data.by);
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp), function () {
          console.log('Setting remote description by answer');
        }, function (e) {
          console.error(e);
        });
        break;
      case 'ice':
        console.log('Received ice by ', data.by);
        if (data.ice) {
          console.log('Adding ice candidates');
          pc.addIceCandidate(new RTCIceCandidate(data.ice));
        }
        break;
    }
  };
});

angular.module('webrtcApp').constant('config', {
  //SIGNALIG_SERVER_URL: 'gds-webrtc.herokuapp.com'
  SIGNALIG_SERVER_URL: 'localhost:5555'
});


angular.module('webrtcApp')
  .directive('peerVideo', function () {
    return {
      template: '<video autoplay playsinline></video>',
      restrict: 'E',
      replace: true,
      /*
      scope: {
        peer: '='
      },
      */
      link: function (scope, element, attrs) {
        console.log('Setting peer Stream: ', scope.peer);
        element[0].srcObject = scope.peer.stream;
      }
    };
  });
