chrome.runtime.sendMessage({ message: "blocked-website-count-request" });
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.message === 'blocked-website-count') {
//         document.getElementById('blocker-count').textContent = request.countOfBlockedWebsites;
//     }
// });
chrome.storage.sync.get(['sharam-karo-stats'], function (blocking_stats) {
    console.log('Stats retrieved', blocking_stats);
    blocking_stats = JSON.parse(blocking_stats['sharam-karo-stats']);
    console.log('after', blocking_stats);
    countOfBlockedWebsites = blocking_stats.blockedSites.reduce(function countTotalBlockedWebsites(sum, curr_site) {
        // console.log(Object.keys(curr_site)[0]);
        return sum + curr_site[Object.keys(curr_site)[0]];
    }, 0);
    document.getElementById('blocker-count').textContent = countOfBlockedWebsites;
});