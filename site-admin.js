(function () {
  "use strict";

  var STORAGE_KEY = "hne-site-admin-content-v1";
  var LAST_SITE_KEY = "hne-site-admin-last-site";
  var DEFAULT_CONTENT = window.HNE_SITE_CONTENT || { version: 1, sites: {} };
  var firebaseConfig = DEFAULT_CONTENT.firebase || {};
  var remoteContent = null;
  var firebaseState = {
    ready: false,
    db: null,
    auth: null,
    storage: null,
    docRef: null,
    user: null,
    adminReady: false
  };

  var PAGE_CONFIG = {
    aularitmica: {
      files: ["indexaularitmica"],
      text: {
        heroTitle: '[data-template-id="hero-title"]',
        subtitle: '[data-template-id="hero-subtitle"]',
        mainText: '[data-template-id="hero-desc"]',
        aboutTitle: '[data-template-id="about-title"]',
        aboutText: '[data-template-id="about-text-1"]',
        aboutText2: '[data-template-id="about-text-2"]'
      },
      images: {
        heroBg: '[data-template-id="hero-bg"]',
        heroPhoto: '[data-template-id="hero-profile"]',
        aboutPhoto: '[data-template-id="about-photo"]'
      }
    },
    motorista: {
      files: ["indexinstru"],
      text: {
        heroTitle: '[data-template-id="hero-title"]',
        subtitle: '[data-template-id="hero-subtitle"]',
        mainText: '[data-template-id="hero-slogan"]',
        aboutTitle: '[data-template-id="about-title"]',
        aboutText: '[data-template-id="about-text"]',
        aboutText2: '[data-template-id="about-text-2"]'
      },
      images: {
        heroBg: '[data-template-id="hero-bg"]',
        heroPhoto: '[data-template-id="hero-portrait"]',
        aboutPhoto: '[data-template-id="about-photo"]'
      }
    },
    show: {
      files: ["indexshow"],
      text: {
        heroTitle: ".hero .hero-content h1",
        mainText: ".hero .hero-content p",
        aboutTitle: "#sobre .section-title",
        aboutText: "#sobre .bio"
      },
      images: {
        heroBg: ".hero"
      }
    }
  };

  function copy(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function merge(base, extra) {
    var output = copy(base);
    if (!extra || typeof extra !== "object") return output;
    Object.keys(extra).forEach(function (key) {
      var value = extra[key];
      if (Array.isArray(value)) {
        output[key] = copy(value);
      } else if (value && typeof value === "object") {
        output[key] = merge(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function getStoredContent() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function getContent() {
    return merge(merge(DEFAULT_CONTENT, getStoredContent()), remoteContent);
  }

  function saveLocalContent(content) {
    var next = merge(DEFAULT_CONTENT, content);
    next.updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return next;
  }

  async function saveContent(content) {
    var next = saveLocalContent(content);
    if (firebaseState.docRef) {
      await firebaseState.docRef.set(next);
      remoteContent = next;
    }
    return next;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function escapeAttr(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function cssUrl(value) {
    return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function textToHtml(value) {
    return escapeHtml(value).replace(/\n/g, "<br>");
  }

  function query(selector) {
    return selector ? document.querySelector(selector) : null;
  }

  function setText(selector, value, multiline) {
    var element = query(selector);
    if (!element || value === undefined || value === null) return;
    if (multiline) {
      element.innerHTML = textToHtml(value);
    } else {
      element.textContent = value;
    }
  }

  function setImage(selector, value, siteKey, imageKey) {
    var element = query(selector);
    if (!element || !value) return;
    if (siteKey === "show" && imageKey === "heroBg") {
      element.style.backgroundImage = 'linear-gradient(rgba(0,0,0,.55), rgba(0,0,0,.7)), url("' + cssUrl(value) + '")';
      return;
    }
    if (element.tagName === "IMG") {
      element.src = value;
    } else {
      element.style.backgroundImage = 'url("' + cssUrl(value) + '")';
    }
  }

  function getSiteKeyFromPath() {
    var path = "";
    try {
      path = decodeURIComponent(window.location.pathname || "").toLowerCase();
    } catch (error) {
      path = (window.location.pathname || "").toLowerCase();
    }
    return Object.keys(PAGE_CONFIG).find(function (siteKey) {
      return PAGE_CONFIG[siteKey].files.some(function (filePart) {
        return path.indexOf(filePart) !== -1;
      });
    });
  }

  function getSectionGrid(titleSelector) {
    var title = query(titleSelector);
    var section = title ? title.closest("section") : null;
    return section ? section.querySelector(".grid") : null;
  }

  function getGalleryContainer(siteKey) {
    if (siteKey === "show") return query("#galeria .galeria");
    return getSectionGrid('[data-template-id="gallery-title"]');
  }

  function getVideosContainer(siteKey) {
    if (siteKey === "show") return query("#videos .videos");
    return getSectionGrid('[data-template-id="videos-title"]');
  }

  function normalizeGallery(gallery) {
    return (Array.isArray(gallery) ? gallery : [])
      .map(function (item, index) {
        if (typeof item === "string") {
          return { src: item.trim(), alt: "Foto " + (index + 1) };
        }
        return {
          src: String((item && item.src) || "").trim(),
          alt: String((item && item.alt) || ("Foto " + (index + 1))).trim()
        };
      })
      .filter(function (item) {
        return item.src;
      });
  }

  function getYoutubeId(input) {
    var value = String(input || "").trim();
    if (!value) return "";
    var patterns = [
      /youtu\.be\/([a-zA-Z0-9_-]{6,})/,
      /youtube\.com\/watch\?[^#]*v=([a-zA-Z0-9_-]{6,})/,
      /youtube\.com\/embed\/([a-zA-Z0-9_-]{6,})/,
      /youtube\.com\/shorts\/([a-zA-Z0-9_-]{6,})/,
      /^[a-zA-Z0-9_-]{6,}$/
    ];
    for (var i = 0; i < patterns.length; i += 1) {
      var match = value.match(patterns[i]);
      if (match) return match[1] || match[0];
    }
    try {
      var url = new URL(value);
      return url.searchParams.get("v") || "";
    } catch (error) {
      return "";
    }
  }

  function normalizeYoutubeUrl(input) {
    var id = getYoutubeId(input);
    return id ? "https://www.youtube.com/embed/" + id : "";
  }

  function renderGallery(siteKey, gallery) {
    var container = getGalleryContainer(siteKey);
    var images = normalizeGallery(gallery);
    if (!container || images.length === 0) return;

    if (siteKey === "show") {
      container.innerHTML = images.map(function (image) {
        return '<img src="' + escapeAttr(image.src) + '" alt="' + escapeAttr(image.alt) + '">';
      }).join("");
      return;
    }

    if (siteKey === "motorista") {
      container.innerHTML = images.map(function (image, index) {
        var rowClass = index === 0 ? " row-span-2" : "";
        var imgClass = index === 0 ? "w-full h-full object-cover" : "w-full h-64 object-cover";
        return '<div class="reveal active rounded-2xl overflow-hidden' + rowClass + '"><img data-template-id="gallery-' + (index + 1) + '" class="canva-image ' + imgClass + '" loading="lazy" src="' + escapeAttr(image.src) + '" alt="' + escapeAttr(image.alt) + '"></div>';
      }).join("");
      return;
    }

    container.innerHTML = images.map(function (image, index) {
      var rowClass = index === 1 ? " md:row-span-2" : "";
      var imgClass = index === 1 ? "w-full h-full min-h-[320px] object-cover hover:scale-105 transition duration-500" : "w-full h-64 object-cover hover:scale-105 transition duration-500";
      return '<div class="fade-in visible cursor-pointer overflow-hidden rounded-2xl' + rowClass + '" onclick="openLightbox(' + index + ')"><img data-template-id="gallery-' + (index + 1) + '" class="canva-image ' + imgClass + '" loading="lazy" src="' + escapeAttr(image.src) + '" alt="' + escapeAttr(image.alt) + '"></div>';
    }).join("");
  }

  function renderVideos(siteKey, videos) {
    var container = getVideosContainer(siteKey);
    if (!container || !Array.isArray(videos)) return;
    var embeds = videos.map(normalizeYoutubeUrl).filter(Boolean);
    container.innerHTML = embeds.map(function (embed, index) {
      var title = "Vídeo " + (index + 1);
      if (siteKey === "show") {
        return '<div class="video"><iframe src="' + escapeAttr(embed) + '" title="' + escapeAttr(title) + '" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
      }
      var stateClass = siteKey === "motorista" ? "reveal active bg-navy/10" : "fade-in visible bg-dark/5";
      return '<div class="' + stateClass + ' rounded-2xl overflow-hidden aspect-video"><iframe class="w-full h-full" src="' + escapeAttr(embed) + '" title="' + escapeAttr(title) + '" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy"></iframe></div>';
    }).join("");
  }

  function patchLightbox() {
    window.openLightbox = function (index) {
      var images = document.querySelectorAll('[data-template-id^="gallery-"], #galeria .galeria img');
      var image = images[index];
      var target = document.getElementById("lightbox-img");
      var box = document.getElementById("lightbox");
      if (image && target && box) {
        target.src = image.src;
        box.classList.add("active");
      }
    };
  }

  function applyPublicPage(siteKey) {
    var resolvedKey = siteKey || getSiteKeyFromPath();
    if (!resolvedKey || !PAGE_CONFIG[resolvedKey]) return;
    var content = getContent();
    var site = content.sites[resolvedKey];
    var config = PAGE_CONFIG[resolvedKey];
    if (!site) return;

    setText(config.text.heroTitle, site.fields && site.fields.heroTitle);
    setText(config.text.subtitle, site.fields && site.fields.subtitle);
    setText(config.text.mainText, site.fields && site.fields.mainText, true);
    setText(config.text.aboutTitle, site.fields && site.fields.aboutTitle);
    setText(config.text.aboutText, site.fields && site.fields.aboutText, true);
    setText(config.text.aboutText2, site.fields && site.fields.aboutText2, true);

    Object.keys(config.images || {}).forEach(function (key) {
      setImage(config.images[key], site.images && site.images[key], resolvedKey, key);
    });

    renderGallery(resolvedKey, site.gallery);
    renderVideos(resolvedKey, site.videos);
    patchLightbox();
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  function generateContentFile(content) {
    return "window.HNE_SITE_CONTENT = " + JSON.stringify(content || getContent(), null, 2) + ";\n";
  }

  function downloadContentFile(content) {
    var blob = new Blob([generateContentFile(content)], { type: "text/javascript;charset=utf-8" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "site-content.js";
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(function () {
      URL.revokeObjectURL(link.href);
    }, 500);
  }

  async function saveContentFile(content) {
    var fileBody = generateContentFile(content);
    if (window.showSaveFilePicker) {
      var handle = await window.showSaveFilePicker({
        suggestedName: "site-content.js",
        types: [{ description: "JavaScript", accept: { "text/javascript": [".js"] } }]
      });
      var writable = await handle.createWritable();
      await writable.write(fileBody);
      await writable.close();
      return true;
    }
    downloadContentFile(content);
    return false;
  }

  function getFirebasePath() {
    return {
      collection: firebaseConfig.collection || "hne_site",
      document: firebaseConfig.document || "content"
    };
  }

  function setupFirebase() {
    if (!firebaseConfig.enabled || !firebaseConfig.config || !window.firebase) return false;
    try {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig.config);
      }
      firebaseState.auth = window.firebase.auth();
      firebaseState.db = window.firebase.firestore();
      firebaseState.storage = window.firebase.storage ? window.firebase.storage() : null;
      var path = getFirebasePath();
      firebaseState.docRef = firebaseState.db.collection(path.collection).doc(path.document);
      firebaseState.ready = true;
      return true;
    } catch (error) {
      console.warn("Firebase indisponível:", error);
      return false;
    }
  }

  function watchRemoteContent(onChange) {
    if (!firebaseState.docRef) return;
    firebaseState.docRef.onSnapshot(function (snapshot) {
      if (snapshot.exists) {
        remoteContent = snapshot.data();
        saveLocalContent(remoteContent);
        if (typeof onChange === "function") onChange(remoteContent);
      }
      applyPublicPage();
    }, function (error) {
      console.warn("Não foi possível ler o Firestore:", error);
    });
  }

  function userIsAdmin(user) {
    var allowed = String(firebaseConfig.adminEmail || "").toLowerCase();
    return !!(user && user.email && user.email.toLowerCase() === allowed);
  }

  function cleanFileName(name) {
    return String(name || "imagem")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90) || "imagem";
  }

  async function uploadImage(siteKey, file, folder) {
    if (!firebaseState.storage) {
      throw new Error("Firebase Storage não carregou.");
    }
    if (!userIsAdmin(firebaseState.user)) {
      throw new Error("Entre com o e-mail autorizado antes de enviar imagem.");
    }
    if (!file) {
      throw new Error("Escolha uma imagem primeiro.");
    }
    if (!file.type || file.type.indexOf("image/") !== 0) {
      throw new Error("O arquivo precisa ser uma imagem.");
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error("Imagem muito grande. Use até 10 MB.");
    }

    var random = Math.random().toString(36).slice(2, 8);
    var fileName = Date.now() + "-" + random + "-" + cleanFileName(file.name);
    var storagePath = "hne_site/" + siteKey + "/" + folder + "/" + fileName;
    var ref = firebaseState.storage.ref().child(storagePath);
    var snapshot = await ref.put(file, {
      contentType: file.type,
      customMetadata: {
        site: siteKey,
        uploadedBy: firebaseState.user.email || ""
      }
    });
    return snapshot.ref.getDownloadURL();
  }

  function initAdmin() {
    var root = document.querySelector("[data-hne-admin]");
    if (!root) return;

    var content = getContent();
    var currentSiteKey = localStorage.getItem(LAST_SITE_KEY) || Object.keys(content.sites)[0];
    var elements = {
      site: document.getElementById("admin-site"),
      heroTitle: document.getElementById("admin-hero-title"),
      subtitle: document.getElementById("admin-subtitle"),
      mainText: document.getElementById("admin-main-text"),
      aboutTitle: document.getElementById("admin-about-title"),
      aboutText: document.getElementById("admin-about-text"),
      aboutText2: document.getElementById("admin-about-text-2"),
      heroBg: document.getElementById("admin-hero-bg"),
      heroPhoto: document.getElementById("admin-hero-photo"),
      aboutPhoto: document.getElementById("admin-about-photo"),
      photoUrl: document.getElementById("admin-photo-url"),
      videoUrl: document.getElementById("admin-video-url"),
      photos: document.getElementById("admin-photo-list"),
      videos: document.getElementById("admin-video-list"),
      status: document.getElementById("admin-status"),
      save: document.getElementById("admin-save"),
      open: document.getElementById("admin-open"),
      download: document.getElementById("admin-download"),
      saveFile: document.getElementById("admin-save-file"),
      reset: document.getElementById("admin-reset"),
      addPhoto: document.getElementById("admin-add-photo"),
      addVideo: document.getElementById("admin-add-video"),
      heroBgFile: document.getElementById("admin-hero-bg-file"),
      heroBgUpload: document.getElementById("admin-upload-hero-bg"),
      heroPhotoFile: document.getElementById("admin-hero-photo-file"),
      heroPhotoUpload: document.getElementById("admin-upload-hero-photo"),
      aboutPhotoFile: document.getElementById("admin-about-photo-file"),
      aboutPhotoUpload: document.getElementById("admin-upload-about-photo"),
      galleryFiles: document.getElementById("admin-gallery-files"),
      galleryUpload: document.getElementById("admin-upload-gallery"),
      loginEmail: document.getElementById("admin-login-email"),
      loginPassword: document.getElementById("admin-login-password"),
      login: document.getElementById("admin-login"),
      logout: document.getElementById("admin-logout"),
      user: document.getElementById("admin-user")
    };

    Object.keys(content.sites).forEach(function (siteKey) {
      var option = document.createElement("option");
      option.value = siteKey;
      option.textContent = content.sites[siteKey].label || siteKey;
      elements.site.appendChild(option);
    });

    elements.loginEmail.value = firebaseConfig.adminEmail || "";

    function siteConfig() {
      return PAGE_CONFIG[currentSiteKey] || {};
    }

    function siteData() {
      return content.sites[currentSiteKey];
    }

    function setStatus(message) {
      elements.status.textContent = message;
      elements.status.dataset.state = message ? "active" : "";
    }

    function setWriteEnabled(enabled) {
      [
        elements.save,
        elements.reset,
        elements.addPhoto,
        elements.addVideo,
        elements.heroBgUpload,
        elements.heroPhotoUpload,
        elements.aboutPhotoUpload,
        elements.galleryUpload
      ].forEach(function (button) {
        if (button) button.disabled = !enabled;
      });
      [
        elements.photoUrl,
        elements.videoUrl,
        elements.heroBgFile,
        elements.heroPhotoFile,
        elements.aboutPhotoFile,
        elements.galleryFiles
      ].forEach(function (field) {
        if (field) field.disabled = !enabled;
      });
    }

    function updateAuthUi(user) {
      firebaseState.user = user || null;
      var allowed = userIsAdmin(user);
      if (!firebaseState.ready) {
        elements.user.textContent = "Firebase não carregou. As alterações ficam apenas neste navegador.";
        setWriteEnabled(true);
        return;
      }
      if (allowed) {
        elements.user.textContent = "Logado como " + user.email + ".";
        elements.login.hidden = true;
        elements.logout.hidden = false;
        elements.loginPassword.hidden = true;
        setWriteEnabled(true);
      } else {
        elements.user.textContent = user ? "E-mail sem permissão: " + user.email : "Entre com " + (firebaseConfig.adminEmail || "o e-mail autorizado") + " para salvar online.";
        elements.login.hidden = false;
        elements.logout.hidden = true;
        elements.loginPassword.hidden = false;
        setWriteEnabled(false);
      }
    }

    function setGroupVisibility() {
      var config = siteConfig();
      Array.prototype.forEach.call(document.querySelectorAll("[data-field-group]"), function (group) {
        var name = group.getAttribute("data-field-group");
        var hasField = (config.text && config.text[name]) || (config.images && config.images[name]);
        group.hidden = !hasField;
      });
    }

    function renderPhotos() {
      var gallery = normalizeGallery(siteData().gallery);
      elements.photos.innerHTML = gallery.map(function (image, index) {
        return '<li class="media-row"><img src="' + escapeAttr(image.src) + '" alt=""><span>' + escapeHtml(image.src) + '</span><button type="button" data-remove-photo="' + index + '" aria-label="Remover foto">Remover</button></li>';
      }).join("");
    }

    function renderVideosList() {
      var videos = Array.isArray(siteData().videos) ? siteData().videos : [];
      elements.videos.innerHTML = videos.map(function (url, index) {
        return '<li class="media-row"><span>' + escapeHtml(url) + '</span><button type="button" data-remove-video="' + index + '" aria-label="Remover vídeo">Remover</button></li>';
      }).join("");
    }

    function fillForm() {
      content = getContent();
      var site = siteData();
      elements.site.value = currentSiteKey;
      elements.heroTitle.value = (site.fields && site.fields.heroTitle) || "";
      elements.subtitle.value = (site.fields && site.fields.subtitle) || "";
      elements.mainText.value = (site.fields && site.fields.mainText) || "";
      elements.aboutTitle.value = (site.fields && site.fields.aboutTitle) || "";
      elements.aboutText.value = (site.fields && site.fields.aboutText) || "";
      elements.aboutText2.value = (site.fields && site.fields.aboutText2) || "";
      elements.heroBg.value = (site.images && site.images.heroBg) || "";
      elements.heroPhoto.value = (site.images && site.images.heroPhoto) || "";
      elements.aboutPhoto.value = (site.images && site.images.aboutPhoto) || "";
      setGroupVisibility();
      renderPhotos();
      renderVideosList();
    }

    function collectForm() {
      var site = merge(siteData(), {});
      site.fields = merge(site.fields || {}, {
        heroTitle: elements.heroTitle.value.trim(),
        subtitle: elements.subtitle.value.trim(),
        mainText: elements.mainText.value.trim(),
        aboutTitle: elements.aboutTitle.value.trim(),
        aboutText: elements.aboutText.value.trim(),
        aboutText2: elements.aboutText2.value.trim()
      });
      site.images = merge(site.images || {}, {
        heroBg: elements.heroBg.value.trim(),
        heroPhoto: elements.heroPhoto.value.trim(),
        aboutPhoto: elements.aboutPhoto.value.trim()
      });
      return site;
    }

    async function saveCurrentSite() {
      if (firebaseState.ready && !userIsAdmin(firebaseState.user)) {
        setStatus("Entre com o e-mail autorizado antes de salvar.");
        return;
      }
      content.sites[currentSiteKey] = collectForm();
      content = await saveContent(content);
      localStorage.setItem(LAST_SITE_KEY, currentSiteKey);
      setStatus(firebaseState.ready ? "Alterações salvas no Firestore." : "Alterações salvas neste navegador.");
    }

    elements.site.addEventListener("change", function () {
      currentSiteKey = elements.site.value;
      localStorage.setItem(LAST_SITE_KEY, currentSiteKey);
      fillForm();
      setStatus("");
    });

    elements.login.addEventListener("click", async function () {
      if (!firebaseState.auth) {
        setStatus("Firebase Auth não carregou.");
        return;
      }
      try {
        await firebaseState.auth.signInWithEmailAndPassword(elements.loginEmail.value.trim(), elements.loginPassword.value);
        elements.loginPassword.value = "";
        setStatus("Login feito.");
      } catch (error) {
        setStatus("Não foi possível entrar. Confira se o usuário existe no Firebase Authentication.");
      }
    });

    elements.logout.addEventListener("click", async function () {
      if (firebaseState.auth) await firebaseState.auth.signOut();
      setStatus("Sessão encerrada.");
    });

    elements.save.addEventListener("click", function () {
      saveCurrentSite().catch(function () {
        setStatus("Erro ao salvar no Firestore.");
      });
    });

    async function uploadToField(fileInput, urlInput, folder) {
      try {
        var file = fileInput.files && fileInput.files[0];
        setStatus("Enviando imagem...");
        var url = await uploadImage(currentSiteKey, file, folder);
        urlInput.value = url;
        fileInput.value = "";
        setStatus("Imagem enviada. Clique em Salvar e aplicar para publicar.");
      } catch (error) {
        setStatus(error.message || "Não foi possível enviar a imagem.");
      }
    }

    elements.heroBgUpload.addEventListener("click", function () {
      uploadToField(elements.heroBgFile, elements.heroBg, "principais");
    });

    elements.heroPhotoUpload.addEventListener("click", function () {
      uploadToField(elements.heroPhotoFile, elements.heroPhoto, "principais");
    });

    elements.aboutPhotoUpload.addEventListener("click", function () {
      uploadToField(elements.aboutPhotoFile, elements.aboutPhoto, "principais");
    });

    elements.galleryUpload.addEventListener("click", async function () {
      var files = Array.prototype.slice.call(elements.galleryFiles.files || []);
      if (!files.length) {
        setStatus("Escolha uma ou mais fotos primeiro.");
        return;
      }
      try {
        setStatus("Enviando " + files.length + " foto(s)...");
        var site = siteData();
        site.gallery = normalizeGallery(site.gallery);
        for (var i = 0; i < files.length; i += 1) {
          var url = await uploadImage(currentSiteKey, files[i], "galeria");
          site.gallery.push({ src: url, alt: files[i].name || ("Foto " + site.gallery.length) });
          setStatus("Enviando foto " + (i + 1) + " de " + files.length + "...");
        }
        elements.galleryFiles.value = "";
        renderPhotos();
        setStatus("Fotos enviadas. Clique em Salvar e aplicar para publicar.");
      } catch (error) {
        setStatus(error.message || "Não foi possível enviar as fotos.");
      }
    });

    elements.open.addEventListener("click", function () {
      window.open(siteData().page, "_blank", "noopener");
    });

    elements.download.addEventListener("click", function () {
      content.sites[currentSiteKey] = collectForm();
      downloadContentFile(content);
      setStatus("Arquivo gerado.");
    });

    elements.saveFile.addEventListener("click", async function () {
      try {
        content.sites[currentSiteKey] = collectForm();
        await saveContentFile(content);
        setStatus("Arquivo pronto.");
      } catch (error) {
        if (error && error.name !== "AbortError") setStatus("Não foi possível salvar o arquivo.");
      }
    });

    elements.reset.addEventListener("click", function () {
      if (!confirm("Restaurar o conteúdo original desta página?")) return;
      content.sites[currentSiteKey] = copy(DEFAULT_CONTENT.sites[currentSiteKey]);
      fillForm();
      setStatus("Página restaurada. Clique em salvar para publicar.");
    });

    elements.addPhoto.addEventListener("click", function () {
      var url = elements.photoUrl.value.trim();
      if (!url) return;
      var site = siteData();
      site.gallery = normalizeGallery(site.gallery);
      site.gallery.push({ src: url, alt: "Foto " + (site.gallery.length + 1) });
      elements.photoUrl.value = "";
      renderPhotos();
    });

    elements.addVideo.addEventListener("click", function () {
      var url = elements.videoUrl.value.trim();
      if (!normalizeYoutubeUrl(url)) {
        setStatus("Link do YouTube inválido.");
        return;
      }
      var site = siteData();
      site.videos = Array.isArray(site.videos) ? site.videos : [];
      site.videos.push(url);
      elements.videoUrl.value = "";
      renderVideosList();
      setStatus("");
    });

    elements.photos.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-photo]");
      if (!button) return;
      var site = siteData();
      var index = Number(button.getAttribute("data-remove-photo"));
      site.gallery = normalizeGallery(site.gallery);
      site.gallery.splice(index, 1);
      renderPhotos();
    });

    elements.videos.addEventListener("click", function (event) {
      var button = event.target.closest("[data-remove-video]");
      if (!button) return;
      var site = siteData();
      var index = Number(button.getAttribute("data-remove-video"));
      site.videos = Array.isArray(site.videos) ? site.videos : [];
      site.videos.splice(index, 1);
      renderVideosList();
    });

    if (firebaseState.auth) {
      firebaseState.auth.onAuthStateChanged(updateAuthUi);
    } else {
      updateAuthUi(null);
    }

    fillForm();
    firebaseState.adminReady = true;
    watchRemoteContent(fillForm);
  }

  function boot() {
    setupFirebase();
    initAdmin();
    applyPublicPage();
    if (!document.querySelector("[data-hne-admin]")) {
      watchRemoteContent(applyPublicPage);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) applyPublicPage();
  });

  window.HNESiteAdmin = {
    getContent: getContent,
    saveContent: saveContent,
    normalizeYoutubeUrl: normalizeYoutubeUrl,
    applyPublicPage: applyPublicPage,
    initAdmin: initAdmin,
    downloadContentFile: downloadContentFile
  };
})();
