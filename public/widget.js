/**
 * Widget nolink.ai : injecte une iframe pour la page d’abonnement d’un partenaire.
 * Usage : <script src="https://votre-domaine.com/widget.js" data-slug="notion"></script>
 * Ou : NolinkWidget.init({ slug: 'notion', target: '#container' });
 */
(function () {
  var base = document.currentScript && document.currentScript.src
    ? document.currentScript.src.replace(/\/widget\.js.*$/, "")
    : "https://nolink.ai";
  function inject(slug, target) {
    var container = typeof target === "string"
      ? document.querySelector(target)
      : target || document.body;
    if (!container) return;
    var iframe = document.createElement("iframe");
    iframe.src = base + "/s/" + encodeURIComponent(slug) + "?embed=1";
    iframe.title = "Nolink - " + (slug || "abonnement");
    iframe.style.cssText = "width:100%;min-height:400px;border:0;border-radius:8px;";
    iframe.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups");
    container.appendChild(iframe);
  }
  window.NolinkWidget = {
    init: function (opts) {
      opts = opts || {};
      var slug = opts.slug || (document.currentScript && document.currentScript.getAttribute("data-slug"));
      if (slug) inject(slug, opts.target);
    },
  };
  var script = document.currentScript;
  if (script && script.getAttribute("data-slug")) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () {
        NolinkWidget.init({ slug: script.getAttribute("data-slug"), target: script.getAttribute("data-target") });
      });
    } else {
      NolinkWidget.init({ slug: script.getAttribute("data-slug"), target: script.getAttribute("data-target") });
    }
  }
})();
