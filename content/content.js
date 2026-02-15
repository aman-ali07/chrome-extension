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

  /**
   * Platform-specific metadata extractors.
   */
  const EXTRACTORS = {
    leetcode() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'leetcode' };
      meta.url = window.location.href;

      const titleEl = document.querySelector('[data-cy="question-title"]');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) {
        const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (slugMatch) meta.title = slugMatch[1].replace(/-/g, ' ');
      }

      const diffEl = document.querySelector('[class*="text-difficulty-"]');
      if (diffEl) {
        const cls = diffEl.className ?? '';
        const match = cls.match(/text-difficulty-(easy|medium|hard)/i);
        meta.difficulty = match ? match[1].toLowerCase() : diffEl.textContent?.trim()?.toLowerCase() ?? null;
      }

      const tagEls = document.querySelectorAll('[data-cy="question-topic-tag"], a[href*="/tag/"]');
      tagEls.forEach((el) => {
        const tag = el.textContent?.trim();
        if (tag && !meta.tags.includes(tag)) meta.tags.push(tag);
      });

      return meta;
    },

    codeforces() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'codeforces' };
      meta.url = window.location.href;

      const titleEl = document.querySelector('.problem-statement .title');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) meta.title = document.title?.replace(/\s*-\s*Codeforces$/, '') ?? null;

      const roundbox = document.querySelector('.roundbox');
      if (roundbox) {
        const ratingMatch = roundbox.textContent?.match(/\*(\d+)/);
        if (ratingMatch) meta.difficulty = ratingMatch[1];

        const tagLinks = roundbox.querySelectorAll('a[href*="/problemset?tags="], .tag-box');
        tagLinks.forEach((el) => {
          const tag = el.textContent?.trim();
          if (tag && !tag.startsWith('*') && !meta.tags.includes(tag)) meta.tags.push(tag);
        });
      }

      return meta;
    },

    gfg() {
      const meta = { title: null, difficulty: null, tags: [], url: null, platform: 'gfg' };
      meta.url = window.location.href;

      const titleEl =
        document.querySelector('h1, .problem-statement h1, [class*="problemHeader"]');
      if (titleEl) meta.title = titleEl.textContent?.trim() ?? null;
      if (!meta.title) {
        const slugMatch = window.location.pathname.match(/\/problems\/([^/]+)/);
        if (slugMatch) meta.title = slugMatch[1].replace(/-/g, ' ');
      }

      const diffEl =
        document.querySelector('[class*="difficulty"], .badge, [class*="Easy"], [class*="Medium"], [class*="Hard"]');
      if (diffEl) {
        const text = diffEl.textContent?.trim() ?? '';
        if (/easy/i.test(text)) meta.difficulty = 'easy';
        else if (/medium/i.test(text)) meta.difficulty = 'medium';
        else if (/hard/i.test(text)) meta.difficulty = 'hard';
      }

      const tagEls = document.querySelectorAll('a[href*="/tag/"], [class*="tag"]');
      tagEls.forEach((el) => {
        const tag = el.textContent?.trim();
        if (tag && tag.length < 50 && !meta.tags.includes(tag)) meta.tags.push(tag);
      });

      return meta;
    },
  };

  /**
   * Extracts problem metadata when on a supported problem page.
   * Returns structured JSON. Handles platform differences.
   *
   * @returns {{ title: string|null, difficulty: string|null, tags: string[], url: string|null, platform: string|null }}
   */
  function extractProblemMetadata() {
    const { platform, problemPage } = detectPlatform();

    const empty = {
      title: null,
      difficulty: null,
      tags: [],
      url: null,
      platform: null,
    };

    if (!platform || !problemPage) return empty;

    const extractor = EXTRACTORS[platform];
    if (!extractor) return { ...empty, platform };

    try {
      const meta = extractor();
      return meta;
    } catch (err) {
      console.warn('extractProblemMetadata failed:', err);
      return { ...empty, platform, url: window.location.href };
    }
  }

  const detection = detectPlatform();
  console.log('Content script loaded on', window.location.href);
  console.log('Platform detection:', detection);

  if (detection.problemPage && detection.platform) {
    const metadata = extractProblemMetadata();
    console.log('Extracted problem metadata:', metadata);
  }
})();
