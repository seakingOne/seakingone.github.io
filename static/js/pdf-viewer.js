/**
 * PDF 内嵌阅读器：使用 PDF.js 将 PDF 各页渲染为 canvas，滚动时懒加载。
 */
(function () {
  var PDFJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  var RENDER_SCALE = 1.4;

  function setStatus(container, text) {
    var el = container.querySelector('.pdf-viewer-status');
    if (el) {
      el.textContent = text;
    }
  }

  function showFallback(container) {
    container.classList.add('is-fallback');
    setStatus(container, '加载失败');
  }

  // 将相对路径转为可请求的完整 URL（兼容中文文件名）
  function resolvePdfUrl(src) {
    try {
      return new URL(src, window.location.origin).href;
    } catch (e) {
      return src;
    }
  }

  function renderPage(pdf, pageNum, canvas) {
    return pdf.getPage(pageNum).then(function (page) {
      var viewport = page.getViewport({ scale: RENDER_SCALE });
      var context = canvas.getContext('2d');

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      return page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;
    });
  }

  function initViewer(container) {
    if (typeof pdfjsLib === 'undefined') {
      showFallback(container);
      return;
    }

    pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_CDN + 'pdf.worker.min.js';

    var pdfUrl = resolvePdfUrl(container.dataset.src);
    var pagesRoot = container.querySelector('.pdf-viewer-pages');
    var rendered = {};

    setStatus(container, '正在加载 PDF…');

    pdfjsLib.getDocument(pdfUrl).promise.then(function (pdf) {
      var total = pdf.numPages;
      setStatus(container, '共 ' + total + ' 页');

      // 为每一页创建占位容器，滚动进入视口时再渲染
      for (var i = 1; i <= total; i++) {
        var pageWrap = document.createElement('div');
        pageWrap.className = 'pdf-page';
        pageWrap.dataset.page = String(i);

        var label = document.createElement('div');
        label.className = 'pdf-page-label';
        label.textContent = '第 ' + i + ' 页';

        var canvas = document.createElement('canvas');
        canvas.className = 'pdf-page-canvas';

        pageWrap.appendChild(label);
        pageWrap.appendChild(canvas);
        pagesRoot.appendChild(pageWrap);
      }

      if (!('IntersectionObserver' in window)) {
        // 不支持懒加载时，依次渲染全部页面
        var chain = Promise.resolve();
        container.querySelectorAll('.pdf-page').forEach(function (pageEl) {
          chain = chain.then(function () {
            var num = parseInt(pageEl.dataset.page, 10);
            return renderPage(pdf, num, pageEl.querySelector('canvas'));
          });
        });
        return chain;
      }

      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          var pageEl = entry.target;
          var pageNum = parseInt(pageEl.dataset.page, 10);

          if (rendered[pageNum]) {
            return;
          }

          rendered[pageNum] = true;
          pageEl.classList.add('is-loading');

          renderPage(pdf, pageNum, pageEl.querySelector('canvas'))
            .then(function () {
              pageEl.classList.remove('is-loading');
              pageEl.classList.add('is-rendered');
            })
            .catch(function () {
              pageEl.classList.remove('is-loading');
              pageEl.classList.add('is-error');
            });

          observer.unobserve(pageEl);
        });
      }, { rootMargin: '200px 0px' });

      container.querySelectorAll('.pdf-page').forEach(function (pageEl) {
        observer.observe(pageEl);
      });
    }).catch(function () {
      showFallback(container);
    });
  }

  function boot() {
    document.querySelectorAll('.pdf-viewer').forEach(initViewer);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
