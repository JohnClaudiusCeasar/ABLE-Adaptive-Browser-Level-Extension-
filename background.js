self.importScripts("config.js");

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "classifyDomain") {
    const result = classifyDomain(message.url);
    sendResponse(result);
  }
  return true;
});
