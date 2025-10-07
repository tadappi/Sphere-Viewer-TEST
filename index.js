/*
 * Copyright 2016 Google Inc. All rights reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 */
'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // Create scenes.
  var scenes = data.scenes.map(function(data) {
    var urlPrefix = "tiles";
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + data.id + "/{z}/{f}/{y}/{x}.jpg",
      { cubeMapPreviewUrl: urlPrefix + "/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);

    var limiter = Marzipano.RectilinearView.limit.traditional(
      data.faceSize, 100*Math.PI/180, 120*Math.PI/180
    );
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // link hotspots
    data.linkHotspots.forEach(function(hotspot) {
      var element = createLinkHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    // info hotspots
    data.infoHotspots.forEach(function(hotspot) {
      var element = createInfoHotspotElement(hotspot);
      scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
    });

    return { data: data, scene: scene, view: view };
  });

  // autorotate
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: 0,
    targetFov: Math.PI/2
  });
  if (data.settings.autorotateEnabled) {
    autorotateToggleElement.classList.add('enabled');
  }
  autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // fullscreen
  if (screenfull.enabled && data.settings.fullscreenButton) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() { screenfull.toggle(); });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) fullscreenToggleElement.classList.add('enabled');
      else fullscreenToggleElement.classList.remove('enabled');
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // scene list
  sceneListToggleElement.addEventListener('click', toggleSceneList);
  if (!document.body.classList.contains('mobile')) showSceneList();
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    el.addEventListener('click', function() {
      switchScene(scene);
      if (document.body.classList.contains('mobile')) hideSceneList();
    });
  });

  // view control buttons
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');
  var velocity = 0.7, friction = 3;
  var controls = viewer.controls();
  controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    sceneNameElement.innerHTML = sanitize(scene.data.name);
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) el.classList.add('current');
      else el.classList.remove('current');
    }
  }

  function showSceneList() { sceneListElement.classList.add('enabled'); sceneListToggleElement.classList.add('enabled'); }
  function hideSceneList() { sceneListElement.classList.remove('enabled'); sceneListToggleElement.classList.remove('enabled'); }
  function toggleSceneList() { sceneListElement.classList.toggle('enabled'); sceneListToggleElement.classList.toggle('enabled'); }

  function startAutorotate() {
    if (!autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }
  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }
  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled'); stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled'); startAutorotate();
    }
  }

  // link hotspot element
  function createLinkHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot', 'link-hotspot');
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    ['-ms-transform','-webkit-transform','transform'].forEach(function(p){
      icon.style[p] = 'rotate(' + hotspot.rotation + 'rad)';
    });
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });
    stopTouchAndScrollEventPropagation(wrapper);
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip','link-hotspot-tooltip');
    tooltip.innerHTML = findSceneDataById(hotspot.target).name;
    wrapper.appendChild(icon); wrapper.appendChild(tooltip);
    return wrapper;
  }

  // ====== Hover Zoom (debounced, animation-safe) ======
  var HOVER_FOV = 0.30;             // ズーム量（小さいほど寄る）
  var HOVER_DURATION = 1200;        // 寄る時間(ms)
  var RETURN_DURATION = 900;        // 戻る時間(ms)
  var HOVER_OUT_DELAY_MS = 250;     // 外れ判定の遅延（デバウンス）

  function createInfoHotspotElement(hotspot) {
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

    wrapper.appendChild(header);
    wrapper.appendChild(text);

    // モーダル（モバイル用）
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);

    var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };

    // ---- Hover/Click handlers with debounce & lock ----
    var savedParams = null;
    var zooming = false;       // アニメ中フラグ
    var hoverActive = false;   // 現在ホバー中か
    var outTimer = null;       // デバウンス用

    function hoverIn() {
      if (hoverActive) return;
      hoverActive = true;

      // デバウンスキャンセル
      if (outTimer) { clearTimeout(outTimer); outTimer = null; }

      stopAutorotate();

      var v = viewer.view();
      if (!savedParams) savedParams = v.parameters();

      zooming = true;
      v.animateTo({
        yaw: hotspot.yaw, pitch: hotspot.pitch, fov: HOVER_FOV
      }, {
        duration: HOVER_DURATION,
        easing: 'inOutSine'
      });
      setTimeout(function(){ zooming = false; }, HOVER_DURATION + 30);
    }

    function hoverOut() {
      // ズーム中は即戻さず、完了後に戻す（デバウンスも追加）
      if (outTimer) clearTimeout(outTimer);
      outTimer = setTimeout(function() {
        if (!hoverActive) return; // 既に外れている
        if (zooming) {            // まだズーム中なら少し待って再度
          return hoverOut();
        }
        var v = viewer.view();
        if (savedParams) {
          v.animateTo({
            yaw: savedParams.yaw, pitch: savedParams.pitch, fov: savedParams.fov
          }, {
            duration: RETURN_DURATION,
            easing: 'inOutSine'
          });
        }
        savedParams = null;
        hoverActive = false;
        startAutorotate();
      }, HOVER_OUT_DELAY_MS);
    }

    if (isTouch) {
      // タッチはクリックで開閉＋寄る/戻る
      header.addEventListener('click', function() { toggle(); hoverIn(); });
      modal.querySelector('.info-hotspot-close-wrapper')
           .addEventListener('click', function(){ toggle(); hoverOut(); });
    } else {
      // PCはヘッダー上のホバーだけで制御（要素が動いても範囲が安定）
      header.addEventListener('mouseenter', function(){
        wrapper.classList.add('visible'); modal.classList.add('visible'); hoverIn();
      });
      header.addEventListener('mouseleave', function(){
        wrapper.classList.remove('visible'); modal.classList.remove('visible'); hoverOut();
      });
      header.addEventListener('focus', hoverIn);
      header.addEventListener('blur', hoverOut);
    }

    stopTouchAndScrollEventPropagation(wrapper);
    return wrapper;
  }
  // ====== /Hover Zoom ======

  function stopTouchAndScrollEventPropagation(element, eventList) {
    var eventList = [ 'touchstart','touchmove','touchend','touchcancel','wheel','mousewheel' ];
    for (var i = 0; i < eventList.length; i++) {
      element.addEventListener(eventList[i], function(event) { event.stopPropagation(); });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) if (scenes[i].data.id === id) return scenes[i];
    return null;
  }
  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) if (data.scenes[i].id === id) return data.scenes[i];
    return null;
  }

  // initial
  switchScene(scenes[0]);
})();
