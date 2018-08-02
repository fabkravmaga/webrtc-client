// Returns true if the code is running in a packaged Chrome App.
function isChromeApp() {
  return (typeof chrome !== 'undefined' &&
          typeof chrome.storage !== 'undefined' &&
          typeof chrome.storage.local !== 'undefined');
}


// Start shims for fullscreen
function setUpFullScreen() {
  if (isChromeApp()) {
    document.cancelFullScreen = function() {
      chrome.app.window.current().restore();
    };
  } else {
    document.cancelFullScreen = document.webkitCancelFullScreen ||
        document.mozCancelFullScreen || document.cancelFullScreen;
  }

  if (isChromeApp()) {
    document.body.requestFullScreen = function() {
      chrome.app.window.current().fullscreen();
    };
  } else {
    document.body.requestFullScreen = document.body.webkitRequestFullScreen ||
        document.body.mozRequestFullScreen || document.body.requestFullScreen;
  }

  document.onfullscreenchange = document.onfullscreenchange ||
        document.onwebkitfullscreenchange || document.onmozfullscreenchange;
}

function isFullScreen() {
  if (isChromeApp()) {
    return chrome.app.window.current().isFullscreen();
  }

  return !!(document.webkitIsFullScreen || document.mozFullScreen ||
    document.isFullScreen); // if any defined and true
}

function fullScreenElement() {
  return document.webkitFullScreenElement ||
      document.webkitCurrentFullScreenElement ||
      document.mozFullScreenElement ||
      document.fullScreenElement;
}

$( document ).ready(function() {
    setUpFullScreen();
});

// full screen have to be initialed by user gesture
//setTimeout(function(){ document.body.requestFullScreen(); }, 1000);
//setTimeout(document.body.requestFullScreen, 1000);

// End shims for fullscreen
