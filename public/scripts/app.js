'use strict';

/*
Object.setPrototypeOf = Object.setPrototypeOf || function(obj, proto) {
  obj.__proto__ = proto;
  return obj;
};
*/

const CHROME_APP_ID = 'kdkgkiakpijcmglnjoghnajiokcjgabg';

function eventTrigger(eventName) {
  window.dispatchEvent(new Event(eventName))
}

// attempt to connect to chrome app for listening for buttons
if (typeof chrome !== 'undefined') {
  var messagingPort = chrome.runtime.connect(CHROME_APP_ID)
  console.log("messaging port established", messagingPort)
  if (messagingPort) {
    messagingPort.onMessage.addListener((msg) => {
      eventTrigger(msg.message)
    })
  }
}

// keypress mapping for 'Y' and 'N'
window.addEventListener("keypress", (event) => {
  // pure char key only
  if (!event.ctrlKey && !event.shiftKey && !event.metaKey && !event.altKey) {
    switch(event.key) {
      case 'y': eventTrigger('digitalportal.call');
                break;
      case 'n': eventTrigger('digitalportal.hangup');
                break;
      case 'l': localStorage.removeItem('webrtcApp_UserId');
                localStorage.removeItem('webrtcApp_UserPass');
                location.reload();
                break;
      //case 'p': $('.webcam').toggleClass('mini');
      //          break;
    }
  }
});

angular.module('webrtcApp', ['ngSanitize']).run(function($rootScope, $timeout){//}, config){
  $rootScope.loginNeeded = false;
  $rootScope.fatalErr = '';
  $rootScope.peers = [];
  $rootScope.loggedIn = false;
  $rootScope.inCall = false; //TODO:boolean for in commonRoom for now.


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



  const iceConfig = { 'iceServers': [
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
                  };

  var peerConnections = {},
      mainSocket;

  function continueSetup() {
    $rootScope.requestLogin = function(id, pass, callback) {
      console.log('Logging in to Server');
      // clean up peer connections
      for (var key in peerConnections) {
        peerConnections[key].close();
        delete peerConnections[key];
      }
      // should have been handled by peer connections close event, but just in case!
      peerConnections = {};
      $rootScope.peers = [];
      $rootScope.loggedIn = false;
      $rootScope.inCall = false;

      localStorage.removeItem('webrtcApp_UserId');
      localStorage.removeItem('webrtcApp_UserPass');
      mainSocket.emit('login', { userId: id, userPass: pass }, function(success){
        if (success) {
          console.log('Login success');
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

    //setup socket
    mainSocket = io.connect();//config.SIGNALIG_SERVER_URL);

    mainSocket.on('kickedout', function () {
      console.log('server kicked us out!');
      //localStorage.removeItem('webrtcApp_UserId');
      //localStorage.removeItem('webrtcApp_UserPass');
      $rootScope.fatalErr = 'Got kicked out by server (Someone might have logged in using same user ID). Webrtc Application closed.';
      if ($rootScope.localStream) {
        $rootScope.localStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
      // clean up peer connections
      for (var key in peerConnections) {
        peerConnections[key].close();
      }
      // should have been handled by peer connections close event, but just in case!
      peerConnections = {};
      $rootScope.peers = [];
      $rootScope.inCall = false;
      $rootScope.$digest();
    });

    mainSocket.on('disconnect', function (reason) {
      // clean up peer connections
      for (var key in peerConnections) {
        peerConnections[key].close();
        delete peerConnections[key];
      }
      // should have been handled by peer connections close event, but just in case!
      peerConnections = {};
      $rootScope.peers = [];
      $rootScope.inCall = false;
      $rootScope.$digest();
    });

    mainSocket.on('reconnect', function () {
      console.log('server reconnected! ');
      if ($rootScope.loggedIn) {
        // reconnecting after connection broked. have to re-login
        console.log('Re-Login');
        mainSocket.emit('login', { userId: $rootScope.userId, userPass: $rootScope.userPass }, function(success){
          if (!success) {
            // TODO: err. re-login failed. need to open login form or throw fatalerr.
            if ($rootScope.localStream) {
              $rootScope.localStream.getTracks().forEach((track) => {
                track.stop();
              });
            }
            $rootScope.fatalErr = 'Unable to re-login after re-establishing connection to server.';
          } else {
            // relogin success join back to commonRoom if previously in room
            if ($rootScope.inCall) {
              console.log('Re-Joining CommonRoom');
              mainSocket.emit('joinCommonRoom');
            }
          }
        });
      }
    });

    mainSocket.on('msg', function (data) {
      handleMessage(data);
    });
    mainSocket.on('peer.connected', function (data) {
      console.log('peer.connected: ', data);
      //makeOffer(data.id);
    });
    mainSocket.on('peer.disconnected', function (data) {
      console.log('peer.disconnected: ', data);
      if (peerConnections[data.id]) {
        peerConnections[data.id].close();
        delete peerConnections[data.id];
      }
      // safari not calling event when calling close
      console.log('Peer disconnected, removing stream');
      $rootScope.peers = $rootScope.peers.filter(function (p) {
        return p.id !== data.id;
      });
      $rootScope.$digest();
    });
    mainSocket.on('peer.joined', function (data) {
      console.log('peer.joined: ', data);
      makeOffer(data.id);
    });
    mainSocket.on('peer.left', function (data) {
      console.log('peer.left: ', data);
      if (peerConnections[data.id]) {
        peerConnections[data.id].close();
        delete peerConnections[data.id];
      }
      // safari not calling event when calling close
      console.log('Peer left, removing stream');
      $rootScope.peers = $rootScope.peers.filter(function (p) {
        return p.id !== data.id;
      });
      $rootScope.$digest();
    });

    // Add event listeners for hard key 'call' and 'hangup' from logitech webcam
    window.addEventListener("digitalportal.call", () => {
      console.log("start call please")
      if ($('.fatalErr:visible').length > 0) {
        location.reload();
        return;
      }

      if ($rootScope.loggedIn && !$rootScope.inCall) {
        console.log('Joining CommonRoom');
        mainSocket.emit('joinCommonRoom');
        $rootScope.inCall = true;
        $rootScope.$digest();
        return;
      }

      // no mapping, just enable webcam
      //playWebcam();
    });
    window.addEventListener("digitalportal.hangup", () => {
      console.log("hangup please")

      if ($rootScope.loggedIn && $rootScope.inCall) {
        console.log('Leaving CommonRoom');
        mainSocket.emit('leaveCommonRoom');
        // clean up peer connections
        for (var key in peerConnections) {
          peerConnections[key].close();
        }
        // should have been handled by peer connections close event, but just in case!
        peerConnections = {};
        $rootScope.peers = [];
        $rootScope.inCall = false;
        $rootScope.$digest();
        return;
      }
      // no mapping, just pause webcam
      //pausedWebcam();
    });

    //try to do login from local storage/cookie first.
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
      //activate login form when no stored profile
      $rootScope.loginNeeded = true;
      $($('.login input')[0]).focus(); //set focus to user id input
    }
  }; // end continueSetup

  function pausedWebcam() {
    if ($rootScope.localStream) {
      /*
      var canvas = $('#pausedWebcam')[0];
      var context = canvas.getContext('2d');
      var video = $('#localStream')[0];
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      */

      $rootScope.localStream.getTracks().forEach(track => {
        track.enabled = false;
      });
      $('.webcam').addClass('paused');
    }
  };

  function playWebcam() {
    if ($rootScope.localStream) {
      /*
      var canvas = $('#pausedWebcam')[0];
      var context = canvas.getContext('2d');
      context.clearRect(0, 0, canvas.width, canvas.height);
      */

      $rootScope.localStream.getTracks().forEach(track => {
        track.enabled = true;
      });
      $('.webcam').removeClass('paused');
    }
  };

  function findLine(sdpLines, prefix, substr) {
    return findLineInRange(sdpLines, 0, -1, prefix, substr);
  };

  function findLineInRange(sdpLines, startLine, endLine, prefix, substr, direction) {
    if (direction === undefined) {
      direction = "asc";
    }
    direction = direction || "asc";
    if (direction === "asc") {
      var realEndLine = endLine !== -1 ? endLine : sdpLines.length;
      for (var i = startLine; i < realEndLine; ++i) {
        if (sdpLines[i].indexOf(prefix) === 0) {
          if (!substr || sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
            return i;
          }
        }
      }
    } else {
      var realStartLine = startLine !== -1 ? startLine : sdpLines.length - 1;
      for (var j = realStartLine; j >= 0; --j) {
        if (sdpLines[j].indexOf(prefix) === 0) {
          if (!substr || sdpLines[j].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
            return j;
          }
        }
      }
    }
    return null;
  };

  function preferBitRate(sdp, bitrate, mediaType) {
    var sdpLines = sdp.split("\r\n");
    var mLineIndex = findLine(sdpLines, "m=", mediaType);
    if (mLineIndex === null) {
      trace("Failed to add bandwidth line to sdp, as no m-line found");
      return sdp;
    }
    var nextMLineIndex = findLineInRange(sdpLines, mLineIndex + 1, -1, "m=");
    if (nextMLineIndex === null) {
      nextMLineIndex = sdpLines.length;
    }
    var cLineIndex = findLineInRange(sdpLines, mLineIndex + 1, nextMLineIndex, "c=");
    if (cLineIndex === null) {
      trace("Failed to add bandwidth line to sdp, as no c-line found");
      return sdp;
    }
    var bLineIndex = findLineInRange(sdpLines, cLineIndex + 1, nextMLineIndex, "b=AS");
    if (bLineIndex) {
      sdpLines.splice(bLineIndex, 1);
    }
    var bwLine = "b=AS:" + bitrate;
    sdpLines.splice(cLineIndex + 1, 0, bwLine);
    sdp = sdpLines.join("\r\n");
    return sdp;
  };

  function getPeerConnection(id) {
    if (peerConnections[id]) {
      return peerConnections[id];
    }
    var pc = new RTCPeerConnection(iceConfig);
    peerConnections[id] = pc;
    //pc.addStream($rootScope.localStream);
    $rootScope.localStream.getTracks().forEach(track => pc.addTrack(track, $rootScope.localStream));
    pc.oniceconnectionstatechange = function (evnt) {
      console.log('Peer connection state changed: ', pc.iceConnectionState);
      if (//pc.iceConnectionState === "failed" ||
          pc.iceConnectionState === "disconnected" ||
          pc.iceConnectionState === "closed") {
        // Handle the failure
        console.log('Peer disconnected/closed: ', id);
        delete peerConnections[id];

        console.log('Peer connection closed, removing stream');
        $rootScope.peers = $rootScope.peers.filter(function (p) {
          return p.id != id;
        });
        $rootScope.$digest();
      }
    };
    pc.onclose = function (evnt) {
      console.log('Peer disconnected/closed: ', id);
    };
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
  };

  function makeOffer(id) {
    var pc = getPeerConnection(id);
    pc.createOffer().then(sdp => {
      sdp.sdp = preferBitRate(sdp.sdp, '8000', 'video');
      return pc.setLocalDescription(sdp);
    }).then(() => {
      console.log('Creating an offer for ', id);
      mainSocket.emit('msg', { by: $rootScope.userId, to: id, sdp: pc.localDescription, type: 'sdp-offer' });
    }).catch(reason => {
      // TODO: error creating offer, what should we do??
      console.error("Error creating offer to ", id);
      console.error("Error creating offer reason: ", reason);
    });
  };

  function handleMessage(data) {
    var pc = getPeerConnection(data.by);
    switch (data.type) {
      case 'sdp-offer':
        console.log('Received offer from ', data.by);
        console.log('Setting remote description by offer');
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
          return pc.createAnswer();
        }).then(answer => {
          answer.sdp = preferBitRate(answer.sdp, '8000', 'video');
          return pc.setLocalDescription(answer);
        }).then(() => {
          console.log('Sending answer to ', data.by);
          mainSocket.emit('msg', { by: $rootScope.userId, to: data.by, sdp: pc.localDescription, type: 'sdp-answer' });
        }).catch(reason => {
          // TODO: error creating answer, what should we do??
          console.error("Error creating answer to ", data.by);
          console.error("Error creating answer reason: ", reason);
        });
        break;
      case 'sdp-answer':
        console.log('Received answer from ', data.by);
        console.log('Setting remote description by answer');
        pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).catch(reason => {
          // TODO: error receiving answer, what should we do??
          console.error("Error receiving answer from ", data.by);
          console.error("Error receiving answer reason: ", reason);
        });
        break;
      case 'ice':
        if (data.ice) {
          console.log('Received ice from ', data.by);
          console.log('Adding ice candidates');
          pc.addIceCandidate(new RTCIceCandidate(data.ice)).catch(reason => {
            // TODO: error adding ice candidate, what should we do??
            console.error("Error receiving ice from ", data.by);
            console.error("Error receiving ice reason: ", reason);
          });
        }
        break;
    }
  };
});

/*
angular.module('webrtcApp').constant('config', {
  SIGNALIG_SERVER_URL: 'localhost:5555'
});
*/

angular.module('webrtcApp')
  .directive('peerVideo', function () {
    return {
      template: '<div class="peerVideo"><video autoplay playsinline></video></div>',
      restrict: 'E',
      replace: true,
      link: function (scope, element, attrs) {
        console.log('Setting peer Stream: ', scope.peer);
        $(element[0]).find('video').each((idx, video) => {
          video.srcObject = scope.peer.stream;
        });
      }
    };
  });
