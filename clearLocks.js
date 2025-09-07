const { getAllActiveDownloads, forceCleanupDownload } = require('./server/services/shared/globalDownloadManager');

const active = getAllActiveDownloads();
console.log('Active downloads:', active.length);

active.forEach(d => {
  console.log(`- ${d.videoId.substring(0, 50)}... (${d.route}, ${d.ageMinutes} min old)`);
  forceCleanupDownload(d.videoId);
  console.log('  -> Force cleaned up');
});

console.log('\nAll locks cleared!');
