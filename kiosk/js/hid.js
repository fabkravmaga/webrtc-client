chrome.app.runtime.onLaunched.addListener(function() {
  console.log("BCC950 catcher loaded")
});

var connectionHandle = 0;
var externalMessagingPort;


chrome.runtime.onConnectExternal.addListener(function (port) {
  initializeHID()
  console.log("connected to app")
  externalMessagingPort = port
})


function initializeHID() {
  chrome.hid.getDevices({vendorId: 1133, productId: 2104}, (devices) => {
    checkIfBCC950(devices[0])
  })
}


function sendEvent(port, eventTopic) {
  port.postMessage({message: eventTopic})
}

function deviceConnectionHandler(some) {
  connectionHandle = some.connectionId;
  chrome.hid.receive(connectionHandle, receiveNext)
  console.log("some",some)
}

function receiveNext(reportId, data) {
  const dataView = new DataView(data)
  const controlCode = dataView.getInt8()
  console.log("reportId", reportId)
  console.log("data", data)
  console.log(dataView.getInt8())
  if (controlCode === 2) { console.log("call"); sendEvent(externalMessagingPort, "digitalportal.call") }
  if (controlCode === 0) { console.log("hangup"); sendEvent(externalMessagingPort, "digitalportal.hangup") }
  chrome.hid.receive(connectionHandle, receiveNext)
}
function checkIfBCC950(deviceAddedEvent) {
  if (!deviceAddedEvent) { return }
 
  const {vendorId, productId, deviceId} = deviceAddedEvent
  if (vendorId == 1133 && productId == 2104) {
    console.log("BCC950 detected")
    console.log("deviceId:", deviceId)
    
    chrome.hid.connect(deviceId, deviceConnectionHandler)
  }
 console.log(deviceAddedEvent)
}