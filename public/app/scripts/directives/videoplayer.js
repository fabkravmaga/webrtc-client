'use strict';

/**
 * @ngdoc directive
 * @name publicApp.directive:VideoPlayer
 * @description
 * # VideoPlayer
 */
angular.module('publicApp')
  .directive('videoPlayer', function ($sce) {
    return {
      //template: '<div><video ng-src="{{trustSrc()}}" autoplay></video></div>',
      template: '<div><video autoplay></video></div>',
      restrict: 'E',
      replace: true,
      scope: {
        //vidSrc: '@',
        peer: '='
      },
      link: function (scope, element) {
        $(element[0]).children('video')[0].srcObject = scope.peer.stream;
        /*
        scope.$watch('peer.stream', function(){
          //element[0].srcObject = scope.peer.stream;
          $(element[0]).children('video')[0] = scope.peer.stream;
        });
        */
        /*
        scope.trustSrc = function () {
          if (!scope.vidSrc) {
            return undefined;
          }
          return $sce.trustAsResourceUrl(scope.vidSrc);
        };
        */
      }
    };
  });
