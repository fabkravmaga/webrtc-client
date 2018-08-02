'use strict';

angular.module('webrtcApp')
  .controller('LoginCtrl', function ($scope, $rootScope, $timeout) {
    $scope.submit = function() {
      // clear error then block ui until callback
      $scope.loginErr = '';
      if (!$scope.userId || !$scope.userPass) {
        $scope.loginErr = 'All field are required.';
      } else {
        $scope.loginErr = '<span class="aniEllipsis">Authenticating</span>';
        $('.login form').addClass('disabled');
        $rootScope.requestLogin($scope.userId, $scope.userPass, function(success){
          if (success) {
            // close login
            $scope.loginErr = '';
            $rootScope.loginNeeded = false;
          } else {
            $rootScope.loginNeeded = true;
            $scope.loginErr = 'Invalid user or password. Please try again.';
          }
          $('.login form').removeClass('disabled');
          $rootScope.$digest();
          $scope.$digest();
        });
      }
    };
  });
