$(document).ready(function() {
    $('body').scrollspy({
        target: '.navbar-fixed-top',
        offset: 80
    });

    // 仅对站内锚点链接启用平滑滚动，避免拦截 /blog/ 等真实跳转
    $('a.page-scroll').on('click', function(event) {
        var href = $(this).attr('href');
        if (!href || href.charAt(0) !== '#') {
            return;
        }
        var $target = $(href);
        if (!$target.length) {
            return;
        }
        event.preventDefault();
        $('html, body').stop().animate({
            scrollTop: $target.offset().top - 50
        }, 500);
        $("#navbar").collapse('hide');
    });
});

var cbpAnimatedHeader = (function() {
    var changeHeaderOn = 200, scrollDebounce = 250;

    function scrollPage() {
      $('.navbar-default').toggleClass('navbar-scroll', scrollY() >= changeHeaderOn);
    }

    function scrollY() {
      return window.pageYOffset || document.documentElement.scrollTop;
    }

    window.addEventListener('scroll', function() { setTimeout(scrollPage, scrollDebounce); }, false);
})();

// Activate WOW.js plugin for animation on scroll
new WOW().init();
