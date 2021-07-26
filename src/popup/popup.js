// chrome.runtime.sendMessage({ message: "blocked-website-count-request" });
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//     if (request.message === 'blocked-website-count') {
//         document.getElementById('blocker-count').textContent = request.countOfBlockedWebsites;
//     }
// });
chrome.storage.sync.get(['sharam-karo-stats'], function (blocking_stats) {
    console.log('Stats retrieved', blocking_stats);
    blocking_stats = JSON.parse(blocking_stats['sharam-karo-stats']);
    console.log('after', blocking_stats);
    const blockedWebsiteAccessAttemptCount = blocking_stats.blockedSites.reduce(function countTotalBlockedWebsites(sum, curr_site) {
        // console.log(Object.keys(curr_site)[0]);
        return sum + curr_site[Object.keys(curr_site)[0]];
    }, 0);

    const countOfBlockedWebsites = blocking_stats.blockedSites ? blocking_stats.blockedSites.length : 0;
    const blockedImageCount = blocking_stats.blockedImageCount ? blocking_stats.blockedImageCount : 0;

    document.querySelector('#access_attempt_count span').textContent = blockedWebsiteAccessAttemptCount;
    document.querySelector('#attepted_blocked_sites span').textContent = countOfBlockedWebsites;
    document.querySelector('#blocked_image_count span').textContent = blockedImageCount;
});