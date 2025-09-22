(function () {
  const i18n = {
    lang: 'es',
    dict: {},
    async setLang(lang) {
      this.lang = lang || 'es';
      try {
        const res = await fetch(`assets/lang-${this.lang}.json`);
        this.dict = await res.json();
        this.apply(document);
        document.documentElement.lang = this.lang;
      } catch (e) {
        console.error('Error loading translations', e);
      }
    },
    t(str) {
      return this.dict[str] || str;
    },
    translateTree(root) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null, false);
      let node;
      while ((node = walker.nextNode())) {
        const txt = node.nodeValue.trim();
        if (txt && this.dict[txt]) {
          node.nodeValue = node.nodeValue.replace(txt, this.dict[txt]);
        }
      }
      if (root.querySelectorAll) {
        root.querySelectorAll('[placeholder]').forEach(el => {
          const ph = el.getAttribute('placeholder');
          if (this.dict[ph]) el.setAttribute('placeholder', this.dict[ph]);
        });
      }
    },
    apply(root = document) {
      this.translateTree(root.body ? root.body : root);
      const templates = root.querySelectorAll ? root.querySelectorAll('template') : [];
      templates.forEach(t => this.translateTree(t.content));
    }
  };
  window.i18n = i18n;
})();
