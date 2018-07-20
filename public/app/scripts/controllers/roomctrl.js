'use strict';

/**
 * @ngdoc function
 * @name publicApp.controller:RoomCtrl
 * @description
 * # RoomCtrl
 * Controller of the publicApp
 */
angular.module('publicApp')
  .controller('RoomCtrl', function ($sce, VideoStream, $location, $routeParams, $scope, Room) {

    if (!window.RTCPeerConnection || !navigator.getUserMedia) {
      $scope.error = 'WebRTC is not supported by your browser. You can try the app with Chrome and Firefox.';
      return;
    }

    VideoStream.get()
    .then(function (s) {
      $scope.localStream = s;
      Room.init(s);
      //stream = URL.createObjectURL(stream);
      if (!$routeParams.roomId) {
        Room.createRoom()
        .then(function (roomId) {
          $location.path('/room/' + roomId);
        });
      } else {
        Room.joinRoom($routeParams.roomId);
      }
    }, function () {
      $scope.error = 'No audio/video permissions. Please refresh your browser and allow the audio/video capturing.';
    });
    $scope.peers = [];
    Room.on('peer.stream', function (peer) {
      console.log('Client connected, adding new stream');
      $scope.peers.push({
        id: peer.id,
        stream: peer.stream //URL.createObjectURL(peer.stream)
      });
    });
    Room.on('peer.disconnected', function (peer) {
      console.log('Client disconnected, removing stream');
      $scope.peers = $scope.peers.filter(function (p) {
        return p.id !== peer.id;
      });
    });

    /*
    $scope.getLocalVideo = function () {
      return stream;//$sce.trustAsResourceUrl(stream);
    };
    */

  })
  .directive('localVideo', function() {
  return {
    link: function(scope, element, attrs, controllers) {
      scope.$watch('localStream', function(){
        element[0].srcObject = scope.localStream;
        // switch to fullScr
      });
      //console.log('here2');
      //$element[0].srcObject = $scope.getLocalVideo();
      //console.log($scope.getLocalVideo());
    }
  };
});
