/**
 * Content script.
 * Runs in the context of web pages; use for reading/modifying the DOM.
 */

(function () {
  'use strict';

  /**
   * URL patterns for coding platform problem pages.
   */
  const URL_PATTERNS = {
    leetcode: [
      /^https?:\/\/(www\.)?leetcode\.com\/problems\/[^/]+\/?(\?.*)?$/,
    ],
    codeforces: [
      /^https?:\/\/(www\.)?codeforces\.com\/problemset\/problem\/\d+\/[A-Za-z0-9]+(\?.*)?$/,
      /^https?:\/\/(www\.)?codeforces\.com\/contest\/\d+\/problem\/[A-Za-z0-9]+(\?.*)?$/,
    ],
    gfg: [
      /^https?:\/\/(www\.)?geeksforgeeks\.org\/problems\/[^/]+\/\d+(\?.*)?$/,
      /^https?:\/\/practice\.geeksforgeeks\.org\/problems\/[^/]+\/\d+(\?.*)?$/,
    ],
  };

  /**
   * DOM selectors that indicate a problem page (not a listing).
   * Empty array = rely on URL only.
   */
  const DOM_MARKERS = {
    leetcode: ['[data-cy="question-title"]', '.question-content', '[data-key="description"]'],
    codeforces: ['.problem-statement', '.problemindexholder'],
    gfg: [], // GFG DOM structure varies; URL pattern is primary
  };

  /**
   * Checks if any URL pattern matches the given URL.
   * @param {string} url
   * @param {RegExp[]} patterns
   * @returns {boolean}
   */
  function urlMatches(url, patterns) {
    return patterns.some((pattern) => pattern.test(url));
  }

  /**
   * Checks if any DOM marker exists on the page.
   * @param {string[]} selectors
   * @returns {boolean}
   */
  function domMatches(selectors) {
    return selectors.some((sel) => {
      try {
        return document.querySelector(sel) !== null;
      } catch {
        return false;
    }
    });
  }

  /**
   * Detects the coding platform and whether the current page is a problem page.
   * Uses URL patterns and DOM markers for detection.
   *
   * @returns {{ platform: "leetcode" | "codeforces" | "gfg" | null, problemPage: boolean }}
   */
  function detectPlatform() {
    const url = window.location.href;
    const result = { platform: null, problemPage: false };

    for (const [platform, patterns] of Object.entries(URL_PATTERNS)) {
      if (!urlMatches(url, patterns)) continue;

      const markers = DOM_MARKERS[platform];
      const hasDomMarker =
        !markers || markers.length === 0 ? true : domMatches(markers);

      result.platform = platform;
      result.problemPage = hasDomMarker;
      break;
    }

    return result;
  }

  console.log('Content script loaded on', window.location.href);
  console.log('Platform detection:', detectPlatform());
})();
