/*
 * Marzipano custom — hotspot-only zoom (manual tween) + open link after zoom
 */
'use strict';

(function () {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // --- 基本DOM要素 ---
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // --- モード判定 ---
  if (window.matchMedia) {
    var setMode = function () {
      if (mql.matches) { document.body.classList.remove('desktop'); document.body.classList.add('mobile'); }
      else { document.body.classList.remove('mobile'); document.body.classList.add('desktop'); }
    };
    var mql = matchMedia('(max-width: 500px), (max-height: 500px)');
    setMode(); mql.addListener(setMode);
  } else { document.body.classList.add('desktop'); }

  // タッチ検出
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function () {
    document.body.classList.remove('no-touch'); document.body.classList.add('touch');
  });

  // IE 旧版
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // --- Viewer ---
  var viewerOpts = { controls: { mouseViewMode: data.settings.mouseViewMode } };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // --- シーン作成 ---
  var scenes = data.scenes.map(function (data) {
    var urlPrefix = 'tiles';
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + '/' + data.id + '/{z}/{f}/{y}/{x}.jpg',
      { cubeMapPreviewUrl: urlPrefix + '/' + data.id + '/preview.jpg' }
    );
    var geometry = new Marzipano.CubeGeometry(data.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(
      data.faceSize, 100*Math.PI/180, 120*Math.PI/180
    );
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });

    // シーンリンク（そのまま）
    data.linkHotspots.forEach(function (hotspot) {
      var el = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // 情報ホットスポット（アイコンのみ／クリックでズーム→リンク）
    data.infoHotspots.forEach(function (hotspot) {
      var el = createInfoHotspotIconOnly(hotspot, view);
      scene.hotspotContainer().createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: data, scene: scene, view: view };
  });

  // --- オートローテーション ---
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (data.settings.autorotateEnabled) autorotateToggleElement.classList.add('enabled');
  autorotateToggleElement.addEventListener('click', toggleAutorotate);
  function startAutorotate(){
    if (!autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate); viewer.setIdleMovement(3000, autorotate);
  }
  function stopAutorotate(){ viewer.stopMovement(); viewer.setIdleMovement(Infinity); }
  function toggleAutorotate(){
    if (autorotateToggleElement.classList.contains('enabled')){
      autorotateToggleElement.classList.remove('enabled'); stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled'); startAutorotate();
    }
  }

  // --- フルスクリーン ---
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function(){ screenfull.toggle(); });
    screenfull.on('change', function(){
      if (screenfull.isFullscreen) fullscreenToggleElement.classList.add('enabled');
      else fullscreenToggleElement.classList.remove('enabled');
    });
  } else { document.body.classList.add('fullscreen-disabled'); }

  // --- シーンリスト ---
  sceneListToggleElement.addEventListener('click', toggleSceneList);
  if (!document.body.classList.contains('mobile')) showSceneList();
  scenes.forEach(function (scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function () {
      switchScene(scene);
      if (document.body.classList.contains('mobile')) hideSceneList();
    });
  });

  function sanitize(s){ return s.replace('&','&amp;').replace('<','&lt;').replace('>','&gt;'); }
  function switchScene(scene){
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    sceneNameElement.innerHTML = sanitize(scene.data.name);
    updateSceneList(scene);
  }
  function updateSceneList(scene){
    for (var i=0;i<sceneElements.length;i++){
      var el = sceneElements[i];
      if (el.getAttribute('data-id')===scene.data.id) el.classList.add('current');
      else el.classList.remove('current');
    }
  }
  function showSceneList(){ sceneListElement.classList.add('enabled'); sceneListToggleElement.classList.add('enabled'); }
  function hideSceneList(){ sceneListElement.classList.remove('enabled'); sceneListToggleElement.classList.remove('enabled'); }
  function toggleSceneList(){ sceneListElement.classList.toggle('enabled'); sceneListToggleElement.classList.toggle('enabled'); }

  // =========================
  // 手作りアニメータ（rAF）
  // =========================
  function easeInOutSine(t){ return 0.5 - 0.5 * Math.cos(Math.PI * t); }
  function lerp(a,b,t){ return a + (b - a) * t; }
  function animateParams(view, from, to, duration, done){
    var start = performance.now();
    function tick(now){
      var t = Math.min(1, (now - start) / duration);
      var k = easeInOutSine(t);
      view.setParameters({ yaw: lerp(from.yaw,to.yaw,k), pitch: lerp(from.pitch,to.pitch,k), fov: lerp(from.fov,to.fov,k) });
      if (t < 1) requestAnimationFrame(tick);
      else if (done) done();
    }
    requestAnimationFrame(tick);
  }

  // ==============================================
  // Link Hotspot（テンプレそのまま）
  // ==============================================
  function createLinkHotspotElement(hotspot){
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot','link-hotspot');
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    ['-ms-transform','-webkit-transform','transform'].forEach(function(p){
      icon.style[p] = 'rotate(' + hotspot.rotation + 'rad)';
    });
    wrapper.addEventListener('click', function(){ switchScene(findSceneById(hotspot.target)); });
    stopTouchAndScrollEventPropagation(wrapper);
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip','link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;
    wrapper.appendChild(icon); wrapper.appendChild(tooltip);
    return wrapper;
  }

  // ==============================================
  // Info Hotspot: アイコンのみ
  // クリック → ホットスポット方向へズーム → 直後にリンクを新タブで開く
  // その後、元のビューにスムーズに戻す＆オートローテ再開
  // ==============================================
  function createInfoHotspotIconOnly(hotspot, view){
    // ラッパ
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot','info-hotspot','info-hotspot--icononly');

    // アイコン（gif相当。実ファイルは info.png を使用）
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icononly-img');
    wrapper.appendChild(icon);

    // hotspot.text の中の最初のリンク先を取得
    var linkHref = null;
    try {
      var tmp = document.createElement('div');
      tmp.innerHTML = hotspot.text || '';
      var a = tmp.querySelector('a[href]');
      if (a) linkHref = a.href;
    } catch(e){ /* no-op */ }

    // クリックでズーム→リンク→戻す
    wrapper.addEventListener('click', function(ev){
      ev.preventDefault();
      ev.stopPropagation();
      if (!linkHref) return; // リンクが無い場合は何もしない

      var before = view.parameters();
      var target = {
        yaw: hotspot.yaw,
        pitch: hotspot.pitch,
        fov: Math.min(before.fov * 0.6, 0.35) // 寄り具合
      };

      stopAutorotate();

      // 寄る（1.0〜1.2秒くらいが自然）
      animateParams(view, before, target, 1100, function(){
        // ズーム完了したら すぐにリンクを新タブで開く
        window.open(linkHref, '_blank');

        // その後に元のビューへ戻す（1.0秒）→少し待って自動回転を再開
        animateParams(view, view.parameters(), before, 1000, function(){
          setTimeout(startAutorotate, 400);
        });
      });
    });

    stopTouchAndScrollEventPropagation(wrapper);
    return wrapper;
  }

  // ==============================================
  // 共通ユーティリティ
  // ==============================================
  function stopTouchAndScrollEventPropagation(element){
    ['touchstart','touchmove','touchend','touchcancel','wheel','mousewheel'].forEach(function(ev){
      element.addEventListener(ev, function(e){ e.stopPropagation(); });
    });
  }

  function findSceneById(id){ for (var i=0;i<scenes.length;i++) if (scenes[i].data.id===id) return scenes[i]; return null; }
  function findSceneDataById(id){ for (var i=0;i<data.scenes.length;i++) if (data.scenes[i].id===id) return data.scenes[i]; return null; }

  // 最初のシーン
  switchScene(scenes[0]);
})();
