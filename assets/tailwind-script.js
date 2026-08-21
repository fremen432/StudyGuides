/*
  study-guide-maker — TAILWIND VARIANT shared script
  Master copy:   C:\vc\config\claude\skills\study-guide-maker\assets\tailwind-script.js
  Deployed copy: C:\vc\apps\StudyGuides\assets\tailwind-script.js
  Sibling of (NOT a replacement for) the original assets\script.js / style.css template —
  see SKILL.md "Tailwind template variant" for when to use which. Vanilla JS, no dependencies,
  no network calls, no build step. Behavior deliberately mirrors the proven original script.js
  (TOC build, header-offset scroll-margin, lightbox, carousel, theme toggle) so none of the bugs
  documented in SKILL.md's "Template fixes already paid for" table get reintroduced — the
  difference here is every DOM-state change toggles plain Tailwind utility classes
  (hidden / -translate-x-full / rotate-180 / etc.) instead of semantic component classes,
  because there IS no component CSS layer in this variant to hook into.
*/
(function () {
  "use strict";

  function slugify(text) {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // Heading text for nav/slug purposes — excludes any decorative inline element that might live
  // inside a heading (kept for parity with the original template's headingLabel(), even though
  // this variant ships no badge spans yet).
  function headingLabel(h) {
    var clone = h.cloneNode(true);
    clone.querySelectorAll("[data-toc-skip], [data-badge]").forEach(function (el) { el.remove(); });
    return clone.textContent.trim();
  }

  function tocLabel(h) {
    return (h.dataset && h.dataset.toc) ? h.dataset.toc.trim() : headingLabel(h);
  }

  // ---------- Header offset ----------
  // The header in this variant has a fixed height (single-line, truncating title — no wrapping
  // badges live in it, unlike the original template), so this is simpler than the original's
  // runtime-measured version: still measured, not hardcoded, in case a future guide's header
  // grows a second row, but there's no separate "main padding" reconciliation needed since every
  // heading's scroll-mt is set directly from the header height plus one fixed breathing-room
  // constant that matches #main-content's own top padding (see template's `pt-8` on <main>).
  function syncHeaderOffset() {
    var header = document.getElementById("site-header");
    if (!header) return;
    function set() {
      var h = header.getBoundingClientRect().height;
      document.documentElement.style.setProperty("--sg-hdr-offset", Math.ceil(h + 32) + "px");
    }
    set();
    window.addEventListener("resize", set);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(set);
  }

  // ---------- Table of contents (auto-built from h2/h3 inside #main-content) ----------
  function buildToc() {
    var main = document.getElementById("main-content");
    var tocRoot = document.getElementById("toc-nav");
    if (!main || !tocRoot) return;

    var headings = main.querySelectorAll("h2, h3");
    if (!headings.length) return;

    var usedIds = {};
    var topList = document.createElement("ul");
    topList.className = "space-y-0.5";
    var currentSubList = null;

    headings.forEach(function (h) {
      h.classList.add("scroll-mt-[var(--sg-hdr-offset)]");
      var fullLabel = headingLabel(h);
      var navLabel = tocLabel(h);
      if (!h.id) {
        var base = slugify(fullLabel);
        var id = base;
        var n = 2;
        while (usedIds[id] || document.getElementById(id)) {
          id = base + "-" + n++;
        }
        h.id = id;
      }
      usedIds[h.id] = true;

      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "#" + h.id;
      a.appendChild(document.createTextNode(navLabel));

      if (h.tagName === "H2") {
        a.className = "block rounded-md px-2 py-1.5 text-[0.9rem] font-semibold text-stone-700 hover:bg-stone-200/70 hover:text-emerald-700 dark:text-stone-200 dark:hover:bg-stone-800/70 dark:hover:text-emerald-400";
        li.appendChild(a);
        topList.appendChild(li);
        currentSubList = document.createElement("ul");
        currentSubList.className = "mt-0.5 mb-1 ml-4 space-y-0.5 border-l border-stone-200 pl-3 dark:border-stone-800";
        li.appendChild(currentSubList);
      } else if (currentSubList) {
        a.className = "block rounded-md px-2 py-1 text-[0.83rem] text-stone-500 hover:bg-stone-200/70 hover:text-emerald-700 dark:text-stone-400 dark:hover:bg-stone-800/70 dark:hover:text-emerald-400";
        li.appendChild(a);
        currentSubList.appendChild(li);
      } else {
        a.className = "block rounded-md px-2 py-1.5 text-[0.9rem] font-semibold text-stone-700 hover:bg-stone-200/70 hover:text-emerald-700 dark:text-stone-200 dark:hover:bg-stone-800/70 dark:hover:text-emerald-400";
        li.appendChild(a);
        topList.appendChild(li);
      }
    });

    // Wrap every H2 <li> in a row with a disclosure caret (real if it has sub-items, an
    // invisible equal-width spacer if not) so every top-level label starts at the same x
    // position — same rationale as the original template's buildToc(), see SKILL.md's bug table.
    Array.prototype.forEach.call(topList.children, function (li) {
      var sub = li.querySelector(":scope > ul");
      var topAnchor = li.querySelector(":scope > a");
      var hasSub = !!(sub && sub.children.length);
      if (sub && !hasSub) sub.remove();

      var row = document.createElement("div");
      row.className = "flex items-center gap-1";
      li.insertBefore(row, topAnchor);
      topAnchor.classList.add("flex-1");

      if (hasSub) {
        li.setAttribute("data-toc-section", "");
        var caret = document.createElement("button");
        caret.type = "button";
        caret.setAttribute("aria-label", "Collapse/expand section");
        caret.className = "flex h-5 w-5 shrink-0 items-center justify-center rounded text-stone-400 transition-transform duration-150 hover:text-emerald-600 dark:hover:text-emerald-400";
        caret.innerHTML = "&#9662;";
        row.appendChild(caret);
        caret.addEventListener("click", function (e) {
          e.preventDefault();
          var collapsed = sub.classList.toggle("hidden");
          caret.classList.toggle("-rotate-90", collapsed);
          li.setAttribute("data-collapsed", collapsed ? "1" : "0");
          syncCollapseAllLabel();
          persistSubsectionCollapseState();
        });
      } else {
        var spacer = document.createElement("span");
        spacer.className = "block h-5 w-5 shrink-0";
        row.appendChild(spacer);
      }
      row.appendChild(topAnchor);
    });

    var nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Table of contents");
    nav.appendChild(topList);
    tocRoot.innerHTML = "";
    tocRoot.appendChild(nav);

    applyStoredSubsectionCollapseState();

    var links = Array.prototype.slice.call(tocRoot.querySelectorAll("a"));
    if ("IntersectionObserver" in window && links.length) {
      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var link = tocRoot.querySelector('a[href="#' + entry.target.id + '"]');
            if (!link) return;
            if (entry.isIntersecting) {
              links.forEach(function (l) {
                l.classList.remove("text-emerald-700", "dark:text-emerald-400", "font-bold");
              });
              link.classList.add("text-emerald-700", "dark:text-emerald-400");
              var parentLi = link.closest("li[data-toc-section]");
              if (parentLi && parentLi.getAttribute("data-collapsed") === "1") {
                var childUl = parentLi.querySelector(":scope > ul");
                var caretBtn = parentLi.querySelector(":scope > div > button");
                if (childUl && !childUl.contains(link)) {
                  // active link is the H2 itself, section can stay collapsed
                } else if (childUl) {
                  childUl.classList.remove("hidden");
                  if (caretBtn) caretBtn.classList.remove("-rotate-90");
                  parentLi.setAttribute("data-collapsed", "0");
                  syncCollapseAllLabel();
                }
              }
            }
          });
        },
        { rootMargin: "-100px 0px -70% 0px" }
      );
      headings.forEach(function (h) { observer.observe(h); });
    }
  }

  function getTocSections() {
    return Array.prototype.slice.call(document.querySelectorAll("#toc-nav li[data-toc-section]"));
  }

  function syncCollapseAllLabel() {
    var btn = document.getElementById("toc-collapse-all");
    if (!btn) return;
    var sections = getTocSections();
    if (!sections.length) {
      btn.classList.add("hidden");
      return;
    }
    var allCollapsed = sections.every(function (li) { return li.getAttribute("data-collapsed") === "1"; });
    var label = btn.querySelector("[data-label]");
    if (label) label.textContent = allCollapsed ? "Expand Sub-sections" : "Collapse Sub-sections";
    btn.setAttribute("aria-pressed", String(allCollapsed));
  }

  function persistSubsectionCollapseState() {
    var sections = getTocSections();
    if (!sections.length) return;
    var allCollapsed = sections.every(function (li) { return li.getAttribute("data-collapsed") === "1"; });
    try { localStorage.setItem("tw-sg-toc-subsections-collapsed", allCollapsed ? "1" : "0"); } catch (e) {}
  }

  function applyStoredSubsectionCollapseState() {
    var stored = null;
    try { stored = localStorage.getItem("tw-sg-toc-subsections-collapsed"); } catch (e) {}
    if (stored === "1") {
      getTocSections().forEach(function (li) {
        var sub = li.querySelector(":scope > ul");
        var caret = li.querySelector(":scope > div > button");
        if (sub) sub.classList.add("hidden");
        if (caret) caret.classList.add("-rotate-90");
        li.setAttribute("data-collapsed", "1");
      });
    }
    syncCollapseAllLabel();
  }

  function initCollapseSubsectionsButton() {
    var btn = document.getElementById("toc-collapse-all");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var sections = getTocSections();
      if (!sections.length) return;
      var allCollapsed = sections.every(function (li) { return li.getAttribute("data-collapsed") === "1"; });
      var makeCollapsed = !allCollapsed;
      sections.forEach(function (li) {
        var sub = li.querySelector(":scope > ul");
        var caret = li.querySelector(":scope > div > button");
        if (sub) sub.classList.toggle("hidden", makeCollapsed);
        if (caret) caret.classList.toggle("-rotate-90", makeCollapsed);
        li.setAttribute("data-collapsed", makeCollapsed ? "1" : "0");
      });
      syncCollapseAllLabel();
      persistSubsectionCollapseState();
    });
  }

  // ---------- Info popover ----------
  function initInfoPopover() {
    var btn = document.getElementById("info-toggle");
    var popover = document.getElementById("info-popover");
    var wrap = document.getElementById("info-wrap");
    if (!btn || !popover || !wrap) return;

    function setOpen(open) {
      popover.classList.toggle("hidden", !open);
      btn.setAttribute("aria-expanded", String(open));
    }

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      setOpen(popover.classList.contains("hidden"));
    });
    document.addEventListener("click", function (e) {
      if (!wrap.contains(e.target)) setOpen(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") setOpen(false);
    });
  }

  // ---------- Theme toggle (2-state: dark class present or not) ----------
  function initTheme() {
    var btn = document.getElementById("theme-toggle");
    var root = document.documentElement;
    if (!btn) return;
    btn.addEventListener("click", function () {
      var next = root.classList.contains("dark") ? "light" : "dark";
      root.classList.toggle("dark", next === "dark");
      try { localStorage.setItem("tw-sg-theme", next); } catch (e) {}
    });
  }

  // ---------- Desktop sidebar collapse (full hide + a small reopen pill) ----------
  function initTocDesktopToggle() {
    var btn = document.getElementById("toc-toggle");
    var reopen = document.getElementById("toc-reopen");
    var sidebar = document.getElementById("toc-sidebar");
    var root = document.documentElement;
    if (!btn || !sidebar || !reopen) return;

    function apply(collapsed) {
      sidebar.classList.toggle("md:hidden", collapsed);
      reopen.classList.toggle("hidden", !collapsed);
      root.classList.toggle("toc-pref-collapsed", collapsed);
      var label = btn.querySelector("[data-label]");
      if (label) label.textContent = collapsed ? "Show Contents" : "Hide Contents";
    }

    var stored = null;
    try { stored = localStorage.getItem("tw-sg-toc-collapsed"); } catch (e) {}
    apply(stored === "1");

    btn.addEventListener("click", function () {
      var collapsed = !sidebar.classList.contains("md:hidden");
      apply(collapsed);
      try { localStorage.setItem("tw-sg-toc-collapsed", collapsed ? "1" : "0"); } catch (e) {}
    });
    reopen.addEventListener("click", function () {
      apply(false);
      try { localStorage.setItem("tw-sg-toc-collapsed", "0"); } catch (e) {}
    });
  }

  // ---------- Mobile nav: hamburger + slide-out drawer ----------
  function initMobileToc() {
    var openBtn = document.getElementById("toc-open");
    var closeBtn = document.getElementById("toc-close");
    var backdrop = document.getElementById("toc-backdrop");
    var sidebar = document.getElementById("toc-sidebar");
    var tocNav = document.getElementById("toc-nav");
    if (!openBtn || !sidebar || !backdrop) return;

    function isOpen() { return sidebar.classList.contains("translate-x-0"); }

    function setOpen(open) {
      sidebar.classList.toggle("translate-x-0", open);
      sidebar.classList.toggle("-translate-x-full", !open);
      backdrop.classList.toggle("hidden", !open);
      openBtn.setAttribute("aria-expanded", String(open));
      document.body.classList.toggle("overflow-hidden", open);
      if (open) (closeBtn || sidebar).focus();
      else openBtn.focus();
    }

    openBtn.addEventListener("click", function () { setOpen(true); });
    if (closeBtn) closeBtn.addEventListener("click", function () { setOpen(false); });
    backdrop.addEventListener("click", function () { setOpen(false); });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && isOpen()) setOpen(false);
    });
    if (tocNav) {
      tocNav.addEventListener("click", function (e) {
        if (e.target.closest("a") && isOpen() && window.matchMedia("(max-width: 767px)").matches) setOpen(false);
      });
    }
    var mq = window.matchMedia("(min-width: 768px)");
    function handleMqChange(e) { if (e.matches && isOpen()) setOpen(false); }
    if (mq.addEventListener) mq.addEventListener("change", handleMqChange);
    else if (mq.addListener) mq.addListener(handleMqChange);
  }

  // ---------- Back to top ----------
  function initBackToTop() {
    var btn = document.getElementById("back-to-top");
    if (!btn) return;
    window.addEventListener("scroll", function () {
      btn.classList.toggle("hidden", window.scrollY <= 500);
    });
    btn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ---------- Lightbox (tap any content photo to view full-screen; carousel-aware) ----------
  function initLightbox() {
    var images = document.querySelectorAll("#main-content img");
    if (!images.length) return;

    var overlay = document.createElement("div");
    overlay.id = "lightbox";
    overlay.className = "fixed inset-0 z-[100] hidden bg-black/95";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.innerHTML =
      '<button type="button" data-lb-close class="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-2xl leading-none text-white hover:bg-white/20" aria-label="Close">&times;</button>' +
      '<button type="button" data-lb-prev class="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white hover:bg-white/20 disabled:opacity-20 sm:left-4" aria-label="Previous photo">&lsaquo;</button>' +
      '<button type="button" data-lb-next class="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-3xl leading-none text-white hover:bg-white/20 disabled:opacity-20 sm:right-4" aria-label="Next photo">&rsaquo;</button>' +
      '<div data-lb-track class="flex h-full w-full snap-x snap-mandatory overflow-x-auto [&::-webkit-scrollbar]:hidden"></div>' +
      '<div data-lb-dots class="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 gap-1.5"></div>';
    document.body.appendChild(overlay);

    var trackEl = overlay.querySelector("[data-lb-track]");
    var dotsEl = overlay.querySelector("[data-lb-dots]");
    var closeBtn = overlay.querySelector("[data-lb-close]");
    var prevBtn = overlay.querySelector("[data-lb-prev]");
    var nextBtn = overlay.querySelector("[data-lb-next]");
    var lastFocused = null;
    var slideEls = [];
    var activeIndex = 0;
    var observer = null;

    function captionTextFor(img) {
      var fig = img.closest("figure");
      var caption = fig ? fig.querySelector("figcaption") : null;
      if (!caption) return "";
      var clone = caption.cloneNode(true);
      var sourceEl = clone.querySelector("[data-figure-source]");
      if (sourceEl) sourceEl.remove();
      return clone.textContent.trim();
    }

    function groupFor(img) {
      var track = img.closest("[data-carousel-track]");
      if (track) return Array.prototype.slice.call(track.querySelectorAll("img"));
      return [img];
    }

    function setActive(index) {
      activeIndex = index;
      var dots = dotsEl.querySelectorAll("[data-lb-dot]");
      dots.forEach(function (dot, i) {
        dot.classList.toggle("bg-white", i === index);
        dot.classList.toggle("bg-white/35", i !== index);
      });
      prevBtn.disabled = index === 0;
      nextBtn.disabled = index === slideEls.length - 1;
    }

    function goTo(index, smooth) {
      index = Math.max(0, Math.min(slideEls.length - 1, index));
      var slide = slideEls[index];
      if (!slide) return;
      slide.scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
    }

    function open(imgs, startIndex) {
      lastFocused = document.activeElement;
      trackEl.innerHTML = "";
      dotsEl.innerHTML = "";
      slideEls = [];

      imgs.forEach(function (srcImg, i) {
        var slide = document.createElement("figure");
        slide.className = "relative flex h-full w-full shrink-0 snap-center flex-col items-center justify-center gap-3 px-4";
        var im = document.createElement("img");
        im.className = "max-h-[80vh] max-w-full rounded-lg object-contain shadow-2xl";
        im.src = srcImg.currentSrc || srcImg.src;
        im.alt = srcImg.alt || "";
        slide.appendChild(im);

        var capText = captionTextFor(srcImg);
        if (capText) {
          var cap = document.createElement("figcaption");
          cap.className = "max-w-2xl text-center text-sm text-white/80";
          cap.textContent = capText;
          cap.addEventListener("click", function (e) { e.stopPropagation(); });
          slide.appendChild(cap);
        }
        trackEl.appendChild(slide);
        slideEls.push(slide);

        if (imgs.length > 1) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.setAttribute("data-lb-dot", "");
          dot.className = "h-2 w-2 rounded-full bg-white/35";
          dot.setAttribute("aria-label", "Photo " + (i + 1) + " of " + imgs.length);
          dot.addEventListener("click", function (e) { e.stopPropagation(); goTo(i, true); });
          dotsEl.appendChild(dot);
        }
      });

      overlay.classList.remove("hidden");
      if (imgs.length <= 1) {
        prevBtn.classList.add("hidden"); nextBtn.classList.add("hidden"); dotsEl.classList.add("hidden");
      } else {
        prevBtn.classList.remove("hidden"); nextBtn.classList.remove("hidden"); dotsEl.classList.remove("hidden");
      }
      document.body.classList.add("overflow-hidden");
      goTo(startIndex, false);
      setActive(startIndex);
      closeBtn.focus();

      if (observer) observer.disconnect();
      observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActive(slideEls.indexOf(entry.target));
          });
        },
        { root: trackEl, threshold: 0.6 }
      );
      slideEls.forEach(function (s) { observer.observe(s); });
    }

    function close() {
      overlay.classList.add("hidden");
      document.body.classList.remove("overflow-hidden");
      if (observer) { observer.disconnect(); observer = null; }
      trackEl.innerHTML = "";
      if (lastFocused && typeof lastFocused.focus === "function") lastFocused.focus();
    }

    overlay.addEventListener("click", close);
    closeBtn.addEventListener("click", function (e) { e.stopPropagation(); close(); });
    prevBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(activeIndex - 1, true); });
    nextBtn.addEventListener("click", function (e) { e.stopPropagation(); goTo(activeIndex + 1, true); });
    document.addEventListener("keydown", function (e) {
      if (overlay.classList.contains("hidden")) return;
      if (e.key === "Escape") { close(); return; }
      if (e.key === "ArrowLeft") { goTo(activeIndex - 1, true); return; }
      if (e.key === "ArrowRight") { goTo(activeIndex + 1, true); return; }
    });

    images.forEach(function (img) {
      img.classList.add("cursor-zoom-in");
      img.setAttribute("tabindex", "0");
      img.setAttribute("role", "button");
      img.setAttribute("aria-label", "View full-screen: " + (img.alt || "image"));
      img.addEventListener("click", function () {
        var group = groupFor(img);
        open(group, group.indexOf(img));
      });
      img.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); img.click(); }
      });
    });
  }

  // ---------- Inline swipeable photo carousel ([data-carousel], 2+ photos) ----------
  function initCarousels() {
    var carousels = document.querySelectorAll("[data-carousel]");
    carousels.forEach(function (carousel) {
      var track = carousel.querySelector("[data-carousel-track]");
      var slides = Array.prototype.slice.call(track.querySelectorAll("figure"));
      if (slides.length < 2) return;

      var dotsEl = document.createElement("div");
      dotsEl.className = "mt-2 flex justify-center gap-1.5";
      var prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "absolute left-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-lg leading-none text-stone-600 shadow hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-25 dark:border-stone-700 dark:bg-stone-900/90 dark:text-stone-300 dark:hover:text-emerald-400";
      prevBtn.setAttribute("aria-label", "Previous photo");
      prevBtn.textContent = "\u2039";
      var nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "absolute right-1 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-stone-300 bg-white/90 text-lg leading-none text-stone-600 shadow hover:border-emerald-600 hover:text-emerald-700 disabled:opacity-25 dark:border-stone-700 dark:bg-stone-900/90 dark:text-stone-300 dark:hover:text-emerald-400";
      nextBtn.setAttribute("aria-label", "Next photo");
      nextBtn.textContent = "\u203a";
      carousel.appendChild(prevBtn);
      carousel.appendChild(nextBtn);
      carousel.appendChild(dotsEl);

      var activeIndex = 0;
      slides.forEach(function (_, i) {
        var dot = document.createElement("button");
        dot.type = "button";
        dot.className = "h-1.5 w-1.5 rounded-full bg-stone-300 dark:bg-stone-700";
        dot.setAttribute("aria-label", "Photo " + (i + 1) + " of " + slides.length);
        dot.addEventListener("click", function () { goTo(i, true); });
        dotsEl.appendChild(dot);
      });

      function setActive(index) {
        activeIndex = index;
        dotsEl.querySelectorAll("button").forEach(function (dot, i) {
          dot.classList.toggle("bg-emerald-600", i === index);
          dot.classList.toggle("dark:bg-emerald-500", i === index);
          dot.classList.toggle("bg-stone-300", i !== index);
          dot.classList.toggle("dark:bg-stone-700", i !== index);
        });
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === slides.length - 1;
      }
      function goTo(index, smooth) {
        index = Math.max(0, Math.min(slides.length - 1, index));
        slides[index].scrollIntoView({ behavior: smooth ? "smooth" : "auto", inline: "center", block: "nearest" });
      }

      prevBtn.addEventListener("click", function () { goTo(activeIndex - 1, true); });
      nextBtn.addEventListener("click", function () { goTo(activeIndex + 1, true); });

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) setActive(slides.indexOf(entry.target));
          });
        },
        { root: track, threshold: 0.6 }
      );
      slides.forEach(function (s) { observer.observe(s); });
      setActive(0);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    syncHeaderOffset();
    buildToc();
    initCollapseSubsectionsButton();
    initInfoPopover();
    initTheme();
    initTocDesktopToggle();
    initMobileToc();
    initBackToTop();
    initCarousels();
    initLightbox();
  });
})();
