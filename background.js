/**
 * Background service worker (Manifest V3).
 * Handles extension lifecycle and events.
 */

chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed.');
});

chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started with extension loaded.');
});
