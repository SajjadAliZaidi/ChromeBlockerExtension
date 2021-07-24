chrome.runtime.sendMessage({ message: "blocked-website-count-request" });
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.message === 'blocked-website-count') {
        document.getElementById('blocker-count').textContent = request.countOfBlockedWebsites;
    }
});
chrome.storage.sync.get(['sharam-karo-stats'], function (items) {
    console.log('Stats retrieved', items);
});