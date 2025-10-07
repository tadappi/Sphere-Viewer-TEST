/*
 * Marzipano custom — precise click-to-zoom (manual tween) + delayed link open
 */
'use strict';

(function () {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Mode detect
  if (window.matchMedia) {
    var setMode = function () {
      if (mql.matches) { document.body.classList.remove('desktop'); document.body.classList.add('mobile'); }
      else { document.body.classList.remove('mobile'); document.body.classList.add('desktop'); }
    };
    var mql = matchMedia('(max-width: 500px), (max-height: 500px)');
    setMode(); mql.addListener(setMode);
  } else { document.body.classList.add('desktop'); }

  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function () {
    document.body.classList.remove('no-touch'); document.body.classList.add('touch');
  });

  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer
  var viewerOpts = { controls: { mouseViewMode: data.settings.mouseViewMode } };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Scenes
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

    data.linkHotspots.forEach(function (hotspot) {
      var el = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    data.infoHotspots.forEach(function (hotspot) {
      var el = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(el, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: data, scene: scene, view: view };
  });

  // Autorotate
  var autorotate = Marzipano.autorotate({ yawSpeed: 0.03, targetPitch: 0, targetFov: Math.PI/2 });
  if (data.settings.autorotateEnabled) autorotateToggleElement.classList.add('enabled');
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function(){ screenfull.toggle(); });
    screenfull.on('change', function(){
      if (screenfull.isFullscreen) fullscreenToggleElement.classList.add('enabled');
      else fullscreenToggleElement.classList.remove('enabled');
    });
  } else { document.body.classList.add('fullscreen-disabled'); }

  sceneListToggleElement.addEventListener('click', toggleSceneList);
  if (!document.body.classList.contains('mobile')) showSceneList();

  scenes.forEach(function (scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function () {
      switchScene(scene);
      if (document.body.classList.contains('mobile')) hideSceneList();
    });
  });

  // Controls
  var controls = viewer.controls(), vel=0.7, fr=3;
  controls.registerMethod('upElement',   new Marzipano.ElementPressControlMethod(document.querySelector('#viewUp'),   'y', -vel, fr), true);
  controls.registerMethod('downElement', new Marzipano.ElementPressControlMethod(document.querySelector('#viewDown'), 'y',  vel, fr), true);
  controls.registerMethod('leftElement', new Marzipano.ElementPressControlMethod(document.querySelector('#viewLeft'), 'x', -vel, fr), true);
  controls.registerMethod('rightElement',new Marzipano.ElementPressControlMethod(document.querySelector('#viewRight'),'x',  vel, fr), true);
  controls.registerMethod('inElement',   new Marzipano.ElementPressControlMethod(document.querySelector('#viewIn'), 'zoom', -vel, fr), true);
  controls.registerMethod('outElement',  new Marzipano.ElementPressControlMethod(document.querySelector('#viewOut'),'zoom',  vel, fr), true);

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

  function startAutorotate(){
    if (!autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate); viewer.setIdleMovement(3000, autorotate);
  }
  function stopAutorotate(){ viewer.stopMovement(); viewer.setIdleMovement(Infinity); }
  function toggleAutorotate(){
    if (autorotateToggleElement.classList.contains('enabled')){
      autorotateToggleElement.classList.remove('enabled'); stopAutorrotate();
    } else {
      autorotateToggleElement.classList.add('enabled'); startAutorotate();
    }
  }
  // typo fix
  function stopAutorrotate(){ stopAutorotate(); }

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
      view.setParameters({
        yaw:   lerp(from.yaw,   to.yaw,   k),
        pitch: lerp(from.pitch, to.pitch, k),
        fov:   lerp(from.fov,   to.fov,   k)
      });
      if (t < 1) requestAnimationFrame(tick);
      else if (done) done();
    }
    requestAnimationFrame(tick);
  }

  // ==============================================
  // クリック位置へ正確にズーム（スムーズ版）
  // ==============================================
  panoElement.addEventListener('click', function (e) {
    var view = viewer.view();
    var before = view.parameters();
    var rect = panoElement.getBoundingClientRect();

    // クリック座標→yaw/pitch 変換（正確）
    var coords = view.screenToCoordinates({ x: e.clientX - rect.left, y: e.clientY - rect.top }, viewer.stage());
    if (!coords || !isFinite(coords.yaw) || !isFinite(coords.pitch)) return;

    var target = {
      yaw: coords.yaw,
      pitch: coords.pitch,
      fov: Math.min(before.fov * 0.6, 0.35) // 小さいほど寄る
    };

    stopAutorotate();

    // 1) 寄る（1.2秒）
    animateParams(view, before, target, 1200, function(){
      // 2) 2秒保持 → 3) 戻る（1.0秒）→ 4) オートローテ再開
      setTimeout(function(){
        animateParams(view, view.parameters(), before, 1000, function(){
          setTimeout(startAutorotate, 400);
        });
      }, 2000);
    });
  });

  // ==============================================
  // ホットスポット内リンク：2秒後に新タブで開く
  // ==============================================
  function attachDelayedOpen(container){
    container.querySelectorAll('a[href]').forEach(function(a){
      a.addEventListener('click', function(ev){
        ev.preventDefault();
        var href = a.href;
        a.style.opacity = '0.6';
        setTimeout(function(){ window.open(href, '_blank'); }, 2000);
      });
    });
  }

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

  function createInfoHotspotElement(hotspot){
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot','info-hotspot');

    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');

    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);

    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);

    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);

    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);

    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;

    attachDelayedOpen(text);

    wrapper.appendChild(header);
    wrapper.appendChild(text);

    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    attachDelayedOpen(modal);

    var toggle = function(){ wrapper.classList.toggle('visible'); modal.classList.toggle('visible'); };
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);

    stopTouchAndScrollEventPropagation(wrapper);
    return wrapper;
  }

  function stopTouchAndScrollEventPropagation(element){
    ['touchstart','touchmove','touchend','touchcancel','wheel','mousewheel'].forEach(function(ev){
      element.addEventListener(ev, function(e){ e.stopPropagation(); });
    });
  }

  function findSceneById(id){ for (var i=0;i<scenes.length;i++) if (scenes[i].data.id===id) return scenes[i]; return null; }
  function findSceneDataById(id){ for (var i=0;i<data.scenes.length;i++) if (data.scenes[i].id===id) return data.scenes[i]; return null; }

  switchScene(scenes[0]);
})();
