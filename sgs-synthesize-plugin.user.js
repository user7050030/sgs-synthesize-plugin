// ==UserScript==
// @name         三国杀·锦囊妙计综合插件
// @namespace    https://github.com/Tihaon7050030/sgs-synthesize-plugin
// @version      1.1.3
// @description  设置展示搜索、立即去红点/新标、锦囊袋圆点入口、屏蔽对手发言/皮肤特效/武将台词，以及 /sound 台词搜索发送。
// @author       Tihaon7050030
// @match        https://game.4399iw2.com/yxxsgs/*
// @match        *://*.sanguosha.com/10/*
// @match        *://*.sanguosha.com/x/*
// @match        *://*.sanguosha.com/10th/*
// @match        https://wan.baidu.com/*gameId=19793616*
// @match        *://h5.7k7k.com/web/H5GAMES.html?gid=960982bec2f555de44ea43ca8a7ef418/*
// @match        *://qqgame.qq.com/webappframe/?appid=10951
// @match        *://s118.app1107877410.qqopenapp.com/pc/qqLobby_index.php*
// @match        *://kuaiwan.com/game/main/9496000/*
// @match        *://kuaiwan.com/start/game.html*
// @match        *://sgsszn.wan.360.cn/*
// @exclude      *://*.sanguosha.com/220/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(() => {
  'use strict';
  if (window.__SGS_SYNTHESIZE__) return;
  window.__SGS_SYNTHESIZE__ = true;

  const VERSION = '1.1.3';
  const AUTHOR = 'Tihaon7050030';
  const STORE_KEY = 'sgs-synthesize:settings:v2';
  const CSS_ID = 'sgs-syn-css';
  const TAB_ID = 'sgs-syn-tab';
  const PANE_ID = 'sgs-syn-pane';
  const BALL_ID = 'sgs-syn-ball';
  const WHITE_DOT_ID = 'sgs-syn-white-dot';
  const STANDALONE_ID = 'sgs-syn-standalone';
  const MODAL_ID = 'sgs-syn-sound-modal';
  const FLOAT_ID = 'sgs-syn-float-modal';
  const TOAST_ID = 'sgs-syn-toast';

  const DEFAULTS = {
    showcaseSearch: false,
    redDotCleaner: false,
    jinnangDot: false,
    blockOpponentChat: false,
    blockOtherSkinEffects: false,
    blockOtherVoice: false,
    panelMode: 'integrated',
    hotkey: '',
    panelLimit: 10,
    modalLimit: 50,
    dotPos: null,
    panelPos: null,
  };

  const uiState = {
    capturingHotkey: false,
    standaloneOpen: false,
  };

  const safe = (fn, fallback) => {
    try {
      const v = fn();
      return v == null ? fallback : v;
    } catch (_) {
      return fallback;
    }
  };

  const settings = Object.assign({}, DEFAULTS, (() => {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  })());

  function saveSettings() {
    safe(() => localStorage.setItem(STORE_KEY, JSON.stringify(settings)));
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function classOf(node) {
    return safe(() => (node.constructor && (node.constructor.__class__ || node.constructor.name)) || '', '');
  }

  function stage() {
    const Laya = window.Laya;
    return Laya && Laya.stage && Laya.stage.numChildren != null ? Laya.stage : null;
  }

  function eachNode(root, fn) {
    if (!root) return;
    const walk = node => {
      if (!node) return;
      fn(node);
      const count = safe(() => node.numChildren, 0);
      for (let i = 0; i < count; i++) walk(safe(() => node.getChildAt(i), null));
    };
    walk(root);
  }

  function findNode(root, name) {
    let found = null;
    eachNode(root, node => {
      if (!found && classOf(node) === name) found = node;
    });
    return found;
  }

  function inGame() {
    const J = window.__JND;
    if (J && typeof J.inGame === 'function') return !!safe(() => J.inGame());
    return !!findNode(stage(), 'TableGameScene');
  }

  function findGameManager() {
    const J = window.__JND;
    if (J && typeof J.findGameManager === 'function') {
      const m = safe(() => J.findGameManager());
      if (m) return m;
    }
    const scene = findNode(stage(), 'TableGameScene');
    return scene ? safe(() => scene.manager || scene.gameManager, null) : null;
  }

  function isSelfSeat(seatID) {
    const J = window.__JND;
    if (J && typeof J.isSelfSeat === 'function') return !!safe(() => J.isSelfSeat(seatID));
    const mgr = findGameManager();
    return !!mgr && Number(seatID) === Number(safe(() => mgr.selfSeatIndex, -1));
  }

  function selfUserId() {
    try {
      const raw = localStorage.getItem('jnd:account-status:v1');
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && obj.selfUserId != null) return String(obj.selfUserId);
      }
    } catch (_) {}
    const mgr = findGameManager();
    const seat = mgr && safe(() => (typeof mgr.SelfSeat === 'function' ? mgr.SelfSeat() : mgr.seats && mgr.seats[mgr.selfSeatIndex]), null);
    const info = seat && safe(() => seat.playerInfo, null);
    const id = safe(() => seat.userID, null) != null ? safe(() => seat.userID, '')
      : safe(() => info && (info.userID || info.UserID || info.clientId || info.ClientId), '');
    return id == null ? '' : String(id);
  }

  function toast(message) {
    if (!document.body) return;
    let el = document.getElementById(TOAST_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TOAST_ID;
      document.body.appendChild(el);
    }
    el.textContent = String(message || '');
    el.classList.add('is-show');
    clearTimeout(el.__timer);
    el.__timer = setTimeout(() => el.classList.remove('is-show'), 2400);
  }
  function installGlobalCss() {
    if (document.getElementById(CSS_ID)) return true;
    const host = document.head || document.documentElement;
    if (!host) return false;
    const css = document.createElement('style');
    css.id = CSS_ID;
    css.textContent = `
      #jnd-panel.jnd-mini-dot:not(.open) { pointer-events: none !important; }
      #jnd-panel.jnd-mini-dot:not(.open)::before { opacity: 0 !important; }
      #jnd-panel.jnd-mini-dot:not(.open) .jnd-face-front { opacity: 0 !important; }
      #jnd-panel.jnd-mini-dot:not(.open)::after { opacity: 0 !important; }
      #jnd-panel.jnd-mini-dot:not(.open) .jnd-panel-collapse { pointer-events: none !important; }
      #${PIPS_ID} {
        position: absolute; left: 18px; top: 18px; z-index: 9;
        width: 26px; height: 26px; box-sizing: border-box;
        display: none; align-items: center; justify-content: center; gap: 3px;
        border-radius: 50%; pointer-events: none;
        background: radial-gradient(circle at 34% 28%, rgba(60, 49, 36, .98), rgba(18, 15, 11, .94) 74%);
        border: 1px solid rgba(214, 173, 78, .68);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, .34), 0 2px 8px rgba(0, 0, 0, .5), 0 0 10px rgba(214, 173, 78, .16);
        transition: border-color .16s ease, box-shadow .16s ease;
      }
      #jnd-panel.jnd-mini-dot:not(.open) #${PIPS_ID} { display: flex; pointer-events: auto; }
      #${PIPS_ID}:hover {
        border-color: rgba(238, 205, 128, .95);
        box-shadow: 0 0 0 1px rgba(0, 0, 0, .34), 0 2px 8px rgba(0, 0, 0, .5), 0 0 14px rgba(230, 190, 100, .3);
      }
      #jnd-panel.jnd-mini-dot.jnd-dock-right:not(.open) #${PIPS_ID} {
        left: auto; right: calc(var(--jnd-entry-w, 200px) - 44px);
      }
      #${PIPS_ID} i {
        width: 3px; height: 3px; border-radius: 50%;
        background: #e6c37c; box-shadow: 0 0 4px rgba(230, 195, 124, .55);
      }
      #jnd-panel.jnd-mini-dot.jnd-dot-update:not(.open) #${PIPS_ID}::after {
        content: ""; position: absolute; right: -1px; top: -1px;
        width: 5px; height: 5px; border-radius: 50%;
        background: #e6c37c; box-shadow: 0 0 5px rgba(230, 195, 124, .8);
      }
      #sgs-syn-tab .jnd-tab-icon svg { width: 18px; height: 18px; }
      #${PANE_ID} { height: 100%; }
      #${PANE_ID} .jnd-pane-main { height: 100%; overflow: auto; padding-bottom: 18px; }
      #${PANE_ID} .sgs-syn-by {
        margin-left: auto; align-self: center; color: #9c7b4a;
        font: 12px "Segoe UI", "Microsoft YaHei", sans-serif; letter-spacing: .3px;
      }
      .sgs-syn-sec {
        display: flex; align-items: center; gap: 8px;
        margin: 15px 2px 7px; color: #d8b979;
        font: 15px "FZBW", "STKaiti", "KaiTi", serif; letter-spacing: 1px;
      }
      .sgs-syn-sec::after {
        content: ""; flex: 1 1 auto; height: 1px;
        background: linear-gradient(90deg, rgba(214, 173, 78, .38), rgba(214, 173, 78, 0));
      }
      .sgs-syn-search-row { display: flex; align-items: center; gap: 8px; }
      .sgs-syn-input {
        flex: 1 1 auto; min-width: 0; height: 34px; box-sizing: border-box;
        padding: 0 10px; border-radius: 6px;
        border: 1px solid rgba(214, 173, 78, .34);
        background: rgba(20, 16, 11, .62);
        color: #f0dfba; outline: none;
        font: 14px "Microsoft YaHei", "Segoe UI", sans-serif;
      }
      .sgs-syn-input::placeholder { color: #8c7858; }
      .sgs-syn-input:focus { border-color: rgba(238, 205, 128, .78); box-shadow: 0 0 0 2px rgba(214, 173, 78, .12); }
      .sgs-syn-btn {
        flex: 0 0 auto; height: 34px; padding: 0 14px; border-radius: 6px; cursor: pointer;
        border: 1px solid rgba(214, 173, 78, .5);
        background: linear-gradient(180deg, rgba(72, 56, 33, .95), rgba(40, 31, 20, .95));
        color: #f1d79b; font: 14px "FZBW", "Microsoft YaHei", serif;
      }
      .sgs-syn-btn:hover { border-color: rgba(238, 205, 128, .95); color: #fff0cd; }
      .sgs-syn-hint { margin: 7px 2px 8px; color: #8f7b5b; font: 12px "Microsoft YaHei", sans-serif; line-height: 1.55; }
      .sgs-syn-hint b { color: #d8b979; font-weight: 600; }
      #jnd-panel.sgs-syn-credits-empty .credits { display: none !important; }
      .sgs-syn-limit-row {
        display: flex; align-items: center; flex-wrap: wrap; gap: 6px;
        margin: 2px 2px 7px; color: #9c8762; font: 12px "Microsoft YaHei", sans-serif;
      }
      .sgs-syn-limit-row b { color: #d9bb7e; font-weight: 600; }
      .sgs-syn-limit-input {
        width: 56px; height: 26px; box-sizing: border-box; padding: 0 6px;
        border-radius: 4px; border: 1px solid rgba(214, 173, 78, .34);
        background: rgba(20, 16, 11, .62); color: #f0dfba; text-align: center;
        font: 12px "Consolas", "Microsoft YaHei", monospace; outline: none;
      }
      .sgs-syn-limit-input:focus { border-color: rgba(238, 205, 128, .8); }
      .sgs-syn-results { display: flex; flex-direction: column; gap: 5px; }
      .sgs-syn-phrase {
        display: flex; align-items: center; gap: 10px;
        width: 100%; box-sizing: border-box; text-align: left; cursor: pointer;
        padding: 8px 10px; border-radius: 6px;
        border: 1px solid rgba(214, 173, 78, .16);
        background: rgba(255, 255, 255, .035);
        color: #eadbb9; font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
      }
      .sgs-syn-phrase:hover {
        border-color: rgba(238, 205, 128, .62);
        background: rgba(214, 173, 78, .1);
      }
      .sgs-syn-phrase-main { flex: 1 1 auto; min-width: 0; }
      .sgs-syn-phrase-text { display: block; font-size: 14px; line-height: 1.45; }
      .sgs-syn-phrase-meta { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 4px; font-size: 11px; color: #9c8762; }
      .sgs-syn-phrase-avatar {
        flex: 0 0 auto; width: 46px; height: 46px; box-sizing: border-box;
        border-radius: 5px; border: 1px solid rgba(214, 173, 78, .58);
        background: rgba(0, 0, 0, .28); object-fit: cover;
        box-shadow: 0 2px 7px rgba(0, 0, 0, .32);
      }
      .sgs-syn-phrase-meta b { color: #d9bb7e; font-weight: 600; }
      .sgs-syn-phrase-meta i { font-style: normal; color: #a9946d; }
      .sgs-syn-phrase-meta em { font-style: normal; color: #8fae9a; }
      .sgs-syn-empty { padding: 16px 6px; color: #8c7858; font-size: 12px; text-align: center; }
      .sgs-syn-count { color: #9c8762; font-size: 11px; padding: 2px 2px 6px; }

      .sgs-syn-mode-label { margin: 2px 2px 6px; color: #cbb184; font: 12px "Microsoft YaHei", sans-serif; }
      .sgs-syn-seg {
        display: flex; width: 100%; box-sizing: border-box; padding: 3px;
        border-radius: 7px; border: 1px solid rgba(214, 173, 78, .22);
        background: rgba(0, 0, 0, .24);
      }
      .sgs-syn-seg button {
        flex: 1 1 50%; height: 28px; border: 0; border-radius: 5px; cursor: pointer;
        background: transparent; color: #9f8965;
        font: 13px "Microsoft YaHei", sans-serif;
      }
      .sgs-syn-seg button.is-active {
        background: linear-gradient(180deg, rgba(112, 83, 42, .92), rgba(68, 50, 28, .92));
        color: #f3ddab; box-shadow: 0 1px 4px rgba(0, 0, 0, .35) inset;
      }
      .sgs-syn-hotkey-row {
        display: flex; align-items: center; gap: 8px; margin-top: 9px;
        color: #cbb184; font: 12px "Microsoft YaHei", sans-serif;
      }
      .sgs-syn-hotkey-row > span { flex: 1 1 auto; }
      .sgs-syn-hotkey-btn {
        min-width: 92px; height: 28px; padding: 0 10px; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(214, 173, 78, .38);
        background: rgba(22, 18, 12, .72); color: #edd39b;
        font: 12px "Consolas", "Microsoft YaHei", monospace;
      }
      .sgs-syn-hotkey-btn:hover { border-color: rgba(238, 205, 128, .9); }
      .sgs-syn-hotkey-btn.is-capturing { color: #ffe7ae; border-color: rgba(238, 205, 128, .95); }
      .sgs-syn-hotkey-clear {
        height: 28px; padding: 0 8px; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(214, 173, 78, .18);
        background: transparent; color: #8f7b5b; font: 12px "Microsoft YaHei", sans-serif;
      }
      .sgs-syn-hotkey-clear:hover { color: #d8b979; border-color: rgba(214, 173, 78, .55); }

      #${WHITE_DOT_ID} {
        position: fixed; left: 18px; bottom: 122px; z-index: 2147483400;
        width: 26px; height: 26px; box-sizing: border-box; padding: 0;
        border-radius: 50%; cursor: grab; display: none; touch-action: none;
        border: 1px solid rgba(255, 255, 255, .85);
        background: radial-gradient(circle at 35% 28%, #ffffff, #d8d2c6 72%, #b8b0a0);
        box-shadow: 0 0 0 2px rgba(0, 0, 0, .22), 0 2px 8px rgba(0, 0, 0, .38);
        transition: box-shadow .14s ease;
      }
      #${WHITE_DOT_ID}:active { cursor: grabbing; }
      #${WHITE_DOT_ID}:hover {
        box-shadow: 0 0 0 2px rgba(0, 0, 0, .22), 0 0 12px rgba(255, 255, 255, .55);
      }
      #${WHITE_DOT_ID}.is-open { background: radial-gradient(circle at 35% 28%, #fff5d6, #e8c578 72%, #b78d42); }

      #${STANDALONE_ID} {
        position: fixed; left: 42px; bottom: 122px; z-index: 2147483500;
        width: min(380px, calc(100vw - 56px)); max-height: min(74vh, 690px);
        display: none; flex-direction: column; box-sizing: border-box;
        border-radius: 10px; border: 1px solid rgba(214, 173, 78, .55);
        background: linear-gradient(180deg, rgba(38, 31, 22, .985), rgba(18, 15, 11, .985));
        box-shadow: 0 18px 52px rgba(0, 0, 0, .6);
        color: #eadbb9; overflow: hidden;
      }
      #${STANDALONE_ID}.is-open { display: flex; }
      .sgs-syn-standalone-head {
        display: flex; align-items: center; gap: 8px; padding: 11px 12px 9px;
        border-bottom: 1px solid rgba(214, 173, 78, .16);
        cursor: grab; touch-action: none;
      }
      #${STANDALONE_ID}.is-dragging .sgs-syn-standalone-head { cursor: grabbing; }
      .sgs-syn-standalone-title { font: 18px "FZBW", "STKaiti", "KaiTi", serif; color: #f0d79a; letter-spacing: 1px; }
      .sgs-syn-standalone-sub { font: 10px "Segoe UI", "Microsoft YaHei", sans-serif; color: #9c7b4a; }
      .sgs-syn-standalone-close {
        margin-left: auto; width: 26px; height: 26px; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(214, 173, 78, .26); background: transparent; color: #c7ae7c; font-size: 18px; line-height: 1;
      }
      .sgs-syn-standalone-close:hover { border-color: rgba(238, 205, 128, .8); color: #ffe9bb; }
      .sgs-syn-standalone-body { flex: 1 1 auto; padding: 8px 12px 12px; overflow: auto; min-height: 0; }
      #${STANDALONE_ID} .jnd-block { margin: 6px 0; }
      #${STANDALONE_ID} .jnd-opt {
        display: flex; align-items: center; gap: 10px; padding: 5px 0;
      }
      #${STANDALONE_ID} .jnd-opt-tx {
        flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 3px;
      }
      #${STANDALONE_ID} .jnd-opt-name {
        display: block; color: #e7d2a7; font: 14px "FZBW", "Microsoft YaHei", serif;
      }
      #${STANDALONE_ID} .jnd-opt-desc {
        display: block; color: #9f8965; font: 11px/1.5 "Microsoft YaHei", sans-serif;
      }
      #${STANDALONE_ID} .jnd-cm-hit {
        flex: 0 0 auto; position: relative; width: 62px; height: 26px;
      }
      #${STANDALONE_ID} .jnd-cm-input {
        position: absolute; inset: 0; width: 100%; height: 100%; margin: 0;
        opacity: 0; cursor: pointer; z-index: 2;
      }
      #${STANDALONE_ID} .jnd-cm-ctl {
        position: absolute; inset: 0; box-sizing: border-box; display: flex;
        align-items: center; justify-content: space-between; padding: 0 6px;
        border-radius: 5px; border: 1px solid rgba(214, 173, 78, .3);
        background: rgba(0, 0, 0, .28); color: #8f7b5b;
        font: 10px "Consolas", monospace;
      }
      #${STANDALONE_ID} .jnd-cm-input:checked + .jnd-cm-ctl {
        border-color: rgba(238, 205, 128, .78);
        background: linear-gradient(180deg, rgba(108, 82, 44, .92), rgba(64, 47, 27, .92));
        color: #ffe6ae;
      }
      #${STANDALONE_ID} .jnd-cm-key { opacity: .45; }
      #${STANDALONE_ID} .jnd-cm-input:checked + .jnd-cm-ctl .jnd-cm-on { opacity: 1; }
      #${STANDALONE_ID} .jnd-cm-input:not(:checked) + .jnd-cm-ctl .jnd-cm-off-label { opacity: 1; }

      .sgs-syn-modal { position: fixed; inset: 0; z-index: 2147483600; display: none; align-items: center; justify-content: center; }
      .sgs-syn-modal.is-open { display: flex; }
      .sgs-syn-modal-backdrop { position: absolute; inset: 0; background: rgba(6, 5, 4, .62); backdrop-filter: blur(2px); }
      .sgs-syn-modal-card {
        position: relative; width: min(660px, calc(100vw - 36px)); max-height: min(78vh, 720px);
        display: flex; flex-direction: column; box-sizing: border-box;
        border-radius: 10px; border: 1px solid rgba(214, 173, 78, .55);
        background: linear-gradient(180deg, rgba(38, 31, 22, .98), rgba(18, 15, 11, .98));
        box-shadow: 0 22px 60px rgba(0, 0, 0, .62), 0 0 0 1px rgba(0, 0, 0, .35) inset;
        color: #eadbb9; overflow: hidden;
      }
      .sgs-syn-modal-head {
        display: flex; align-items: center; gap: 10px; padding: 14px 16px 10px;
        border-bottom: 1px solid rgba(214, 173, 78, .16);
      }
      .sgs-syn-modal-title { font: 20px "FZBW", "STKaiti", "KaiTi", serif; color: #f0d79a; letter-spacing: 1px; }
      .sgs-syn-modal-sub { font: 12px "Consolas", monospace; color: #a98d5d; }
      .sgs-syn-modal-close {
        margin-left: auto; width: 30px; height: 30px; border-radius: 5px; cursor: pointer;
        border: 1px solid rgba(214, 173, 78, .26); background: transparent; color: #c7ae7c; font-size: 20px; line-height: 1;
      }
      .sgs-syn-modal-close:hover { border-color: rgba(238, 205, 128, .8); color: #ffe9bb; }
      .sgs-syn-modal-body { padding: 12px 16px 14px; display: flex; flex-direction: column; min-height: 0; }
      .sgs-syn-modal-results { margin-top: 9px; overflow: auto; min-height: 60px; padding-right: 2px; }
      .sgs-syn-modal-foot { padding: 8px 16px 12px; border-top: 1px solid rgba(214, 173, 78, .14); color: #8f7b5b; font-size: 11px; }
      .sgs-syn-modal-body .sgs-syn-input { height: 38px; font-size: 15px; }
      .sgs-syn-modal-body .sgs-syn-btn { height: 38px; }

      #${BALL_ID} {
        position: fixed; right: 18px; bottom: 118px; z-index: 2147483400;
        width: 48px; height: 48px; border-radius: 50%; cursor: pointer;
        display: none; align-items: center; justify-content: center;
        border: 1px solid rgba(214, 173, 78, .72);
        background: radial-gradient(circle at 35% 28%, rgba(65, 53, 38, .98), rgba(18, 15, 11, .96) 74%);
        box-shadow: 0 4px 16px rgba(0, 0, 0, .55), 0 0 14px rgba(214, 173, 78, .18);
        color: #ecd08b; font: 20px "FZBW", "STKaiti", serif;
      }
      #${BALL_ID}:hover { border-color: rgba(238, 205, 128, .98); color: #fff0cd; box-shadow: 0 4px 18px rgba(0, 0, 0, .6), 0 0 20px rgba(230, 190, 100, .3); }
      #${TOAST_ID} {
        position: fixed; left: 50%; bottom: 92px; transform: translate(-50%, 8px);
        z-index: 2147483700; max-width: min(70vw, 520px); box-sizing: border-box;
        padding: 9px 16px; border-radius: 7px;
        border: 1px solid rgba(214, 173, 78, .55);
        background: rgba(22, 18, 12, .96); color: #f0dfba;
        font: 13px "Microsoft YaHei", sans-serif; text-align: center;
        opacity: 0; pointer-events: none; transition: opacity .16s ease, transform .16s ease;
      }
      #${TOAST_ID}.is-show { opacity: 1; transform: translate(-50%, 0); }
    `;
    host.appendChild(css);
    return true;
  }
  const showcase = {
    root: null,
    input: null,
    clear: null,
    win: null,
    lastView: null,
    lastVisible: false,
    term: '',
    viewHooked: new WeakSet(),
    winHooked: new WeakSet(),
    positioned: '',
  };

  function showcaseCssReady() {
    return !!document.getElementById(CSS_ID);
  }

  function findShowcaseWin(root) {
    if (!root) return null;
    let found = null;
    eachNode(root, node => {
      if (found) return;
      if (classOf(node) === 'NewStyleUserInfoDisplaySettingWindow' && safe(() => node.visible, false)) found = node;
    });
    return found;
  }

  function showcaseCurrentView(win) {
    return safe(() => win.viewStack.selectedChild, null) || null;
  }

  function showcaseTextOf(item, isSkin) {
    if (!item) return '';
    if (isSkin) {
      const skin = item.skinVO || {};
      const base = skin.skinBaseVO || {};
      const general = skin.generalInfo || {};
      return [base.ItemName, base.Searchkey, base.Desc, base.PvName, general.generalName, general.searchkey, general.ShortName, general.PvName]
        .filter(Boolean).join(' ').toLowerCase();
    }
    return [item.generalName, item.searchkey, item.ShortName, item.PvName, item.rolePoint]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function showcaseFilterView(view) {
    if (!settings.showcaseSearch) return;
    const panel = safe(() => view && view.panel, null);
    if (!panel) return;
    const term = showcase.term.trim().toLowerCase();
    if (!term) return;
    const data = safe(() => panel.DataProvider, null);
    if (!Array.isArray(data)) return;
    const isSkin = /SkinView/i.test(classOf(view)) || safe(() => Boolean(data[0] && data[0].skinVO), false);
    const tokens = term.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];
    if (!tokens.length) return;
    panel.DataProvider = data.filter(item => {
      const hay = showcaseTextOf(item, isSkin);
      return hay && tokens.every(token => hay.indexOf(token) !== -1);
    });
  }

  function showcaseHookView(view) {
    if (!view || showcase.viewHooked.has(view) || typeof view.UpdatePanel !== 'function') return;
    showcase.viewHooked.add(view);
    const original = view.UpdatePanel;
    view.UpdatePanel = function () {
      const result = original.apply(this, arguments);
      safe(() => showcaseFilterView(this));
      return result;
    };
  }

  function showcaseHookWin(win) {
    if (!win || showcase.winHooked.has(win)) return;
    showcase.winHooked.add(win);
    const original = win.onTabClick;
    if (typeof original === 'function') {
      win.onTabClick = function (index) {
        const result = original.apply(this, arguments);
        showcaseRefresh(120);
        return result;
      };
    }
  }

  function showcaseRefresh(delay) {
    if (!settings.showcaseSearch) return;
    const task = () => {
      const win = showcase.win || findShowcaseWin(stage());
      if (!win) return;
      const view = showcaseCurrentView(win);
      if (!view) return;
      showcaseHookView(view);
      safe(() => view.UpdatePanel());
    };
    if (delay) setTimeout(task, delay);
    else task();
  }

  function ensureShowcaseUi() {
    if (showcase.root || !document.body || !showcaseCssReady()) return;
    const root = document.createElement('div');
    root.id = 'sgs-syn-showcase-search';
    root.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6"></circle><path d="M15 15l5 5"></path></svg><input type="text" spellcheck="false" autocomplete="off" placeholder="搜索武将 / 皮肤 / 拼音"><button type="button" aria-label="清空搜索">×</button>';
    document.body.appendChild(root);
    showcase.root = root;
    showcase.input = root.querySelector('input');
    showcase.clear = root.querySelector('button');
    const style = document.createElement('style');
    style.textContent = `
      #sgs-syn-showcase-search {
        position: fixed; z-index: 2147483000; display: none; align-items: center;
        box-sizing: border-box; padding: 0 4px 0 6px; gap: 4px;
        background: linear-gradient(180deg, #f6ead0 0%, #e9d5ac 100%);
        border: 1px solid #8a683c; border-radius: 4px;
        box-shadow: inset 0 1px 3px rgba(120, 82, 32, .32), 0 1px 2px rgba(0, 0, 0, .35);
        font-family: "FZBW", "STKaiti", "KaiTi", "Microsoft YaHei", serif;
      }
      #sgs-syn-showcase-search svg {
        width: 14px; height: 14px; flex: 0 0 auto; fill: none;
        stroke: #7c5a2e; stroke-width: 2; stroke-linecap: round;
      }
      #sgs-syn-showcase-search input {
        flex: 1 1 auto; min-width: 0; height: 100%; margin: 0; padding: 0;
        border: 0; outline: 0; background: transparent;
        color: #4f3427; font: inherit; letter-spacing: .5px;
      }
      #sgs-syn-showcase-search input::placeholder { color: #8b7357; }
      #sgs-syn-showcase-search button {
        flex: 0 0 auto; display: none; width: 18px; height: 18px; margin: 0; padding: 0;
        border: 0; background: transparent; color: #7a5a32; cursor: pointer;
        font: inherit; font-size: 16px; line-height: 18px;
      }
      #sgs-syn-showcase-search button:hover { color: #3f2a16; }
    `;
    (document.head || document.documentElement).appendChild(style);
    const input = showcase.input;
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup', 'mousedown', 'pointerdown']) input.addEventListener(type, stop);
    root.addEventListener('mousedown', stop);
    root.addEventListener('pointerdown', stop);
    const apply = () => {
      showcase.term = input.value || '';
      showcase.clear.style.display = showcase.term ? 'block' : 'none';
      showcaseRefresh();
    };
    input.addEventListener('input', apply);
    input.addEventListener('compositionend', apply);
    showcase.clear.addEventListener('click', () => {
      input.value = '';
      apply();
      input.focus();
    });
  }

  function positionShowcase(win) {
    const canvas = document.getElementById('layaCanvas') || document.querySelector('canvas');
    const Laya = window.Laya;
    if (!canvas || !Laya || !Laya.stage || !showcase.root) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const scaleX = rect.width / Laya.stage.width;
    const scaleY = rect.height / Laya.stage.height;
    const point = win.localToGlobal(new Laya.Point(700, 10));
    const left = rect.left + point.x * scaleX;
    const top = rect.top + point.y * scaleY;
    const width = 280 * scaleX;
    const height = 30 * scaleY;
    const key = [left, top, width, height].map(v => Math.round(v * 100) / 100).join('|');
    if (key === showcase.positioned) return;
    showcase.positioned = key;
    const style = showcase.root.style;
    style.left = `${left}px`;
    style.top = `${top}px`;
    style.width = `${width}px`;
    style.height = `${height}px`;
    style.fontSize = `${Math.max(12, Math.round(16 * scaleX * 10) / 10)}px`;
  }

  function showcaseTick() {
    if (!settings.showcaseSearch) {
      if (showcase.root) showcase.root.style.display = 'none';
      if (showcase.lastVisible) {
        showcase.lastVisible = false;
        showcase.term = '';
        showcase.lastView = null;
        if (showcase.input) showcase.input.value = '';
        if (showcase.clear) showcase.clear.style.display = 'none';
      }
      return;
    }
    const rootStage = stage();
    if (!rootStage) return;
    const win = findShowcaseWin(rootStage);
    showcase.win = win;
    if (!win) {
      if (showcase.root) showcase.root.style.display = 'none';
      if (showcase.lastVisible) {
        showcase.lastVisible = false;
        showcase.term = '';
        showcase.lastView = null;
        if (showcase.input) showcase.input.value = '';
        if (showcase.clear) showcase.clear.style.display = 'none';
      }
      return;
    }
    ensureShowcaseUi();
    if (!showcase.root) return;
    showcase.root.style.display = 'flex';
    positionShowcase(win);
    showcaseHookWin(win);
    const view = showcaseCurrentView(win);
    if (view) {
      showcaseHookView(view);
      if (!showcase.lastVisible || view !== showcase.lastView) {
        showcase.lastView = view;
        showcaseRefresh(60);
      }
    }
    if (!showcase.lastVisible) {
      showcase.lastVisible = true;
      showcaseRefresh(80);
    }
  }

  function restoreShowcase() {
    const win = findShowcaseWin(stage());
    const view = win && showcaseCurrentView(win);
    if (view) safe(() => view.UpdatePanel());
  }
  const RED = /red[_\-.]?point|redpoint|red[_\-.]?dot|reddot|topredpoint|newfunc_redpoint|generalskincollectredpoint/i;
  const NEW = /(?:newstylebasenew|newmodebtnnew|newmodesecondbtnnewtag|newmodeshuanneijianflg|nsskinnewflag|nsskinbagnewtag|generalskin[a-z]*new|generalwindownewflag|generalwindownewicon|newtag|newflag|newicon|newmark)\.(?:png|jpg|jpeg|webp)(?:\?|$)/i;
  const EMPTY_URLS = [
    'https://web.sanguosha.com/10/pc/baseUI/EmptyImg.png',
    'baseUI/EmptyImg.png',
  ];
  const SKIN_GENERAL_CONTEXT = /NewStyleUserInfoDisplay|NSSkin|NSGeneral|GeneralSkin|SkinCollect|GeneralWindow|NewStyleGeneral/i;

  const redDot = {
    trans: null,
    installed: false,
    sweepScheduled: false,
    origTextures: new WeakMap(),
    origCmds: new WeakMap(),
  };

  function textureUrl(tex) {
    if (!tex) return '';
    return safe(() => String(tex.url || tex._url || (tex.source && (tex.source.src || tex.source.url)) || ''), '');
  }

  function badgeKind(value) {
    if (!value) return null;
    const url = typeof value === 'string' ? value : textureUrl(value);
    if (!url) return null;
    if (NEW.test(url)) return 'new';
    if (RED.test(url)) return 'red';
    return null;
  }

  function transparentTexture() {
    if (redDot.trans) return redDot.trans;
    const Laya = window.Laya;
    for (const url of EMPTY_URLS) {
      const tex = safe(() => Laya.loader && Laya.loader.getRes(url), null);
      if (tex) {
        redDot.trans = tex;
        return tex;
      }
    }
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1;
      canvas.height = 1;
      redDot.trans = new Laya.Texture(canvas);
      return redDot.trans;
    } catch (_) {}
    return null;
  }

  function inSkinGeneralContext(node) {
    let cur = node;
    for (let i = 0; i < 14 && cur; i++) {
      if (SKIN_GENERAL_CONTEXT.test(classOf(cur))) return true;
      cur = safe(() => cur._parent, null) || safe(() => cur.parent, null);
    }
    return false;
  }

  function blankNode(node, kind) {
    const trans = redDot.trans;
    if (!trans) return false;
    if (kind === 'new' && inSkinGeneralContext(node)) return false;
    const tex = safe(() => node.texture, null);
    if (!tex || !badgeKind(tex)) return false;
    if (!redDot.origTextures.has(node)) redDot.origTextures.set(node, tex);
    safe(() => { node.texture = trans; });
    return true;
  }

  function restoreNode(node) {
    const tex = redDot.origTextures.get(node);
    if (!tex) return false;
    safe(() => { node.texture = tex; });
    redDot.origTextures.delete(node);
    return true;
  }

  function blankCmd(cmd, node) {
    const trans = redDot.trans;
    if (!trans || !cmd) return false;
    let changed = false;
    const kind = badgeKind(cmd.texture);
    if (kind && !(kind === 'new' && inSkinGeneralContext(node))) {
      if (!redDot.origCmds.has(cmd)) redDot.origCmds.set(cmd, cmd.texture);
      cmd.texture = trans;
      changed = true;
    }
    if (Array.isArray(cmd.textures)) {
      for (let i = 0; i < cmd.textures.length; i++) {
        const k = badgeKind(cmd.textures[i]);
        if (k && !(k === 'new' && inSkinGeneralContext(node))) {
          if (!cmd.__sgsSynTexOrig) cmd.__sgsSynTexOrig = cmd.textures.slice();
          cmd.textures[i] = trans;
          changed = true;
        }
      }
    }
    return changed;
  }

  function restoreCmd(cmd) {
    if (!cmd) return false;
    let changed = false;
    if (redDot.origCmds.has(cmd)) {
      cmd.texture = redDot.origCmds.get(cmd);
      redDot.origCmds.delete(cmd);
      changed = true;
    }
    if (cmd.__sgsSynTexOrig) {
      cmd.textures = cmd.__sgsSynTexOrig;
      delete cmd.__sgsSynTexOrig;
      changed = true;
    }
    return changed;
  }

  function redDotSweep() {
    const Laya = window.Laya;
    if (!Laya || !Laya.stage) return;
    if (!redDot.trans) redDot.trans = transparentTexture();
    if (!redDot.trans) return;
    eachNode(Laya.stage, node => {
      const tex = safe(() => node.texture, null);
      if (tex && badgeKind(tex)) {
        if (settings.redDotCleaner) blankNode(node, badgeKind(tex));
        else restoreNode(node);
      } else if (!settings.redDotCleaner && redDot.origTextures.has(node)) {
        restoreNode(node);
      }
      const cmds = safe(() => node.graphics && node.graphics._cmds, null);
      if (Array.isArray(cmds)) {
        for (const cmd of cmds) {
          if (settings.redDotCleaner) blankCmd(cmd, node);
          else restoreCmd(cmd);
        }
      }
    });
  }

  function scheduleRedDotSweep() {
    if (redDot.sweepScheduled) return;
    redDot.sweepScheduled = true;
    setTimeout(() => {
      redDot.sweepScheduled = false;
      if (settings.redDotCleaner) redDotSweep();
    }, 60);
  }

  function hookRedDot() {
    const Laya = window.Laya;
    if (!Laya || redDot.installed) return;
    const S = Laya.Sprite && Laya.Sprite.prototype;
    if (!S) return;
    for (const name of ['addChild', 'addChildAt', 'addChildren']) {
      const original = safe(() => S[name], null);
      if (typeof original !== 'function' || original.__sgsSynWrapped) continue;
      const wrapped = function () {
        const result = original.apply(this, arguments);
        scheduleRedDotSweep();
        return result;
      };
      wrapped.__sgsSynWrapped = true;
      S[name] = wrapped;
    }
    redDot.installed = true;
  }

  function redDotTick() {
    const Laya = window.Laya;
    if (!Laya || !Laya.stage) return;
    hookRedDot();
    if (!settings.redDotCleaner) return;
    if (!redDot.trans) redDot.trans = transparentTexture();
    if (redDot.trans) redDotSweep();
  }
  const PIPS_ID = 'sgs-syn-pips';

  function ensureDotStyle() {
    if (document.getElementById(CSS_ID)) return;
  }

  function ensurePips(panel) {
    let pips = document.getElementById(PIPS_ID);
    if (pips && pips.parentElement === panel) return;
    if (pips) pips.remove();
    pips = document.createElement('div');
    pips.id = PIPS_ID;
    pips.setAttribute('aria-hidden', 'true');
    pips.innerHTML = '<i></i><i></i><i></i>';
    panel.appendChild(pips);
  }

  function dotTick() {
    const panel = document.getElementById('jnd-panel');
    if (!panel) return;
    ensureDotStyle();
    if (settings.jinnangDot) {
      if (!panel.classList.contains('jnd-mini-dot')) panel.classList.add('jnd-mini-dot');
      ensurePips(panel);
    } else {
      panel.classList.remove('jnd-mini-dot');
      const pips = document.getElementById(PIPS_ID);
      if (pips) pips.remove();
    }
  }
  const BLOCK_CHAT_TYPES = new Set([1, 14, 21, 57]);
  const runtime = {
    chatPatched: false,
    chatManager: null,
    skinPatched: false,
    seatProtos: new WeakSet(),
    seatUiState: new WeakMap(),
    managerProtoState: new WeakMap(),
    effectProtos: new WeakSet(),
    manager: null,
    voiceMute: false,
    blockLog: [],
    chatScanAt: 0,
  };

  function noteBlock(method, seat, kind) {
    try {
      runtime.blockLog.push({
        method,
        seat: seat && seat.Index != null ? seat.Index : null,
        kind,
        at: Date.now(),
      });
      if (runtime.blockLog.length > 300) runtime.blockLog.shift();
      window.__SGS_SYN_BLOCK_LOG__ = runtime.blockLog;
    } catch (_) {}
  }

  function managerSeats(mgr) {
    if (!mgr) return [];
    const seats = mgr.seats;
    if (Array.isArray(seats)) return seats.filter(Boolean);
    if (seats && typeof seats === 'object') {
      return Object.keys(seats).map(key => seats[key]).filter(Boolean);
    }
    return [];
  }

  function isSelfPlayerSeat(seat) {
    if (!seat) return false;
    if (seat.IsSelf === true) return true;
    const index = Number(seat.Index != null ? seat.Index : seat.index);
    return Number.isFinite(index) && index >= 0 && isSelfSeat(index);
  }

  function replaceBoundListener(dispatcher, original, replacement, caller) {
    if (!dispatcher || typeof original !== 'function' || typeof replacement !== 'function') return false;
    const events = safe(() => dispatcher._events, null);
    if (!events || typeof events !== 'object') return false;
    let changed = false;
    for (const type of Object.keys(events)) {
      const value = events[type];
      const list = Array.isArray(value)
        ? value
        : (value && typeof value === 'object' && (typeof value.method === 'function' || typeof value.listener === 'function') ? [value] : null);
      if (!list) continue;
      for (const entry of list) {
        if (!entry) continue;
        const bound = typeof entry.method === 'function' ? entry.method : entry.listener;
        if (bound !== original) continue;
        if (caller && entry.caller !== caller) continue;
        if (typeof entry.method === 'function') entry.method = replacement;
        else entry.listener = replacement;
        changed = true;
      }
    }
    return changed;
  }

  function chatManagerFromEvents(events) {
    if (!events || typeof events !== 'object') return null;
    for (const type of Object.keys(events)) {
      const value = events[type];
      const list = Array.isArray(value) ? value : [value];
      for (const entry of list) {
        if (!entry) continue;
        const caller = entry.caller;
        if (!caller) continue;
        const cn = safe(() => caller.constructor && caller.constructor.name, '');
        if (cn === 'ChatManager' || (typeof caller.SendSkinChatPhrase === 'function' && typeof caller.SendChatMsg === 'function')) return caller;
      }
    }
    return null;
  }

  function scanForChatManager() {
    const seen = new WeakSet();
    let found = null;
    const visit = (obj, depth) => {
      if (found || !obj || typeof obj !== 'object' || depth > 6 || seen.has(obj)) return;
      seen.add(obj);
      const cn = safe(() => obj.constructor && obj.constructor.name, '');
      if (cn === 'ChatManager' || (typeof obj.SendSkinChatPhrase === 'function' && typeof obj.SendChatMsg === 'function')) {
        found = obj;
        return;
      }
      if (cn === 'WBMgr' || (obj._events && typeof obj.SendProto === 'function')) {
        const manager = chatManagerFromEvents(obj._events);
        if (manager) {
          found = manager;
          return;
        }
      }
      let keys = [];
      try { keys = Object.keys(obj); } catch (_) { return; }
      for (const key of keys) {
        if (key === '_parent' || key === 'parent' || key === 'owner') continue;
        let value;
        try { value = obj[key]; } catch (_) { continue; }
        if (value && typeof value === 'object') visit(value, depth + 1);
        if (found) return;
      }
    };
    const roots = [];
    if (window.__SGS) roots.push(window.__SGS);
    if (window.Sgs) roots.push(window.Sgs);
    if (window.SGSMODULE) roots.push(window.SGSMODULE);
    for (const root of roots) {
      visit(root, 0);
      if (found) return found;
    }
    try {
      for (const key of Object.keys(window)) {
        if (/^(document|location|history|navigator|localStorage|sessionStorage|indexedDB|caches|frames|parent|top|self|window|globalThis|Laya|console|performance|screen|crypto|chrome|webkit|external|opener|frameElement)$/.test(key)) continue;
        let value;
        try { value = window[key]; } catch (_) { continue; }
        if (value && typeof value === 'object' && !value.tagName && !(value instanceof Node)) {
          visit(value, 1);
          if (found) return found;
        }
      }
    } catch (_) {}
    const Laya = window.Laya;
    if (Laya && Laya.stage) visit(Laya.stage, 0);
    return found;
  }

  function findChatManager(allowScan, force) {
    if (runtime.chatManager) return runtime.chatManager;
    const J = window.__JND;
    if (J && typeof J.getOfficialProtocolManager === 'function') {
      const pm = safe(() => J.getOfficialProtocolManager(), null);
      const manager = pm && chatManagerFromEvents(pm._events);
      if (manager) {
        runtime.chatManager = manager;
        return manager;
      }
    }
    if (!allowScan) return null;
    const now = Date.now();
    if (!force && runtime.chatScanAt && now - runtime.chatScanAt < 2500) return null;
    runtime.chatScanAt = now;
    const manager = scanForChatManager();
    if (manager) runtime.chatManager = manager;
    return manager;
  }

  function jinnangSoundAvailable() {
    const J = window.__JND;
    if (!J || typeof J.sendOfficialSkinPhrase !== 'function') return false;
    const plugin = safe(() => J.plugins && J.plugins.get && J.plugins.get('voice-phrases'), null);
    if (plugin && plugin.state && plugin.state !== 'running') return false;
    return true;
  }

  function isOtherChat(e) {
    if (!e) return false;
    if (e.isAllServerBroadcast) return false;
    const self = selfUserId();
    if (!self) return false;
    let uid = e.userID;
    if (uid == null) uid = safe(() => e.UserBrief && e.UserBrief.userID, null);
    if (uid == null) return false;
    const text = String(uid);
    if (text === '0' || text === '-1') return false;
    return text !== self;
  }

  function hookChatManager() {
    if (runtime.chatPatched) return;
    const allowScan = inGame() && (settings.blockOpponentChat || settings.blockOtherVoice);
    const cm = findChatManager(allowScan);
    if (!cm) return;
    const proto = safe(() => cm.constructor && cm.constructor.prototype, null);
    const original = safe(() => proto && proto.parseChatMessage, null);
    if (typeof original !== 'function' || original.__sgsSynWrapped) return;
    const wrapped = function (e, t) {
      try {
        if (!inGame()) return original.call(this, e, t);
        if (settings.blockOpponentChat && isOtherChat(e) && BLOCK_CHAT_TYPES.has(Number(e && e.msgType))) {
          noteBlock('parseChatMessage', null, 'chat');
          return undefined;
        }
        if (settings.blockOtherVoice && isOtherChat(e) && Number(e && e.msgType) === 52) {
          runtime.voiceMute = true;
          try {
            return original.call(this, e, t);
          } finally {
            runtime.voiceMute = false;
          }
        }
      } catch (_) {}
      return original.call(this, e, t);
    };
    wrapped.__sgsSynWrapped = true;
    proto.parseChatMessage = wrapped;
    runtime.chatPatched = true;
  }

  function hookSoundManager() {
    const Laya = window.Laya;
    const SM = Laya && Laya.SoundManager;
    if (!SM || typeof SM.playSound !== 'function' || SM.playSound.__sgsSynWrapped) return;
    const original = SM.playSound;
    const wrapped = function (url) {
      const value = String(url || '');
      if (runtime.voiceMute && /\/voice\//i.test(value) && !/\/voice\/effect\//i.test(value)) return;
      return original.apply(this, arguments);
    };
    wrapped.__sgsSynWrapped = true;
    SM.playSound = wrapped;
  }

  function patchSeatVoicePrototype(proto) {
    if (!proto || runtime.seatProtos.has(proto)) return;
    for (const name of ['PlaySkillSound', 'PlaySpellSoundByRes', 'PlayDeadSound', 'PlayFanJingSound']) {
      const original = safe(() => proto[name], null);
      if (typeof original !== 'function') continue;
      const wrapped = function () {
        if (settings.blockOtherVoice && !isSelfPlayerSeat(this)) {
          noteBlock(name, this, 'voice');
          return undefined;
        }
        return original.apply(this, arguments);
      };
      try {
        proto[name] = wrapped;
      } catch (_) {}
    }
    for (const name of ['PlayDebut', 'PlayEnterEffect', 'PlayTitleEffect', 'PlaySkinSuitEffect']) {
      const original = safe(() => proto[name], null);
      if (typeof original !== 'function') continue;
      const wrapped = function () {
        if (settings.blockOtherSkinEffects && !isSelfPlayerSeat(this)) {
          noteBlock(name, this, 'skin');
          return undefined;
        }
        return original.apply(this, arguments);
      };
      try {
        proto[name] = wrapped;
      } catch (_) {}
    }
    runtime.seatProtos.add(proto);
  }

  function patchSeatUiPrototype(proto) {
    if (!proto) return;
    let state = runtime.seatUiState.get(proto);
    if (!state) {
      state = { origDynamic: null, dynamicWrapper: null, origUseSkill: null, useSkillWrapper: null, extra: [] };
      runtime.seatUiState.set(proto, state);
    }

    if (!state.origDynamic) {
      const original = safe(() => proto.onPlayDynamicSkinEffect, null);
      if (typeof original === 'function') {
        const wrapped = function () {
          if (settings.blockOtherSkinEffects && !isSelfPlayerSeat(this.seat)) {
            noteBlock('onPlayDynamicSkinEffect', this.seat, 'skin');
            return undefined;
          }
          return original.apply(this, arguments);
        };
        try {
          proto.onPlayDynamicSkinEffect = wrapped;
          state.origDynamic = original;
          state.dynamicWrapper = wrapped;
        } catch (_) {}
      }
    }

    if (!state.origUseSkill) {
      const original = safe(() => proto.onUseSkill, null);
      if (typeof original === 'function') {
        const wrapped = function () {
          const result = original.apply(this, arguments);
          try {
            if (settings.blockOtherSkinEffects && !isSelfPlayerSeat(this.seat)) {
              const effect = this.specialSkinSkillEffect;
              if (effect) {
                noteBlock('onUseSkill', this.seat, 'skin');
                const effectProto = effect.constructor && effect.constructor.prototype;
                const playEffect = effectProto && effectProto.PlayEffect;
                if (typeof playEffect === 'function' && !runtime.effectProtos.has(effectProto)) {
                  const wrappedPlay = function (seat) {
                    if (settings.blockOtherSkinEffects && !isSelfPlayerSeat(seat)) return;
                    return playEffect.apply(this, arguments);
                  };
                  try {
                    effectProto.PlayEffect = wrappedPlay;
                    runtime.effectProtos.add(effectProto);
                  } catch (_) {}
                }
                safe(() => effect.clearLastEffect());
                safe(() => effect.destroy());
              }
              this.specialSkinSkillEffect = null;
            }
          } catch (_) {}
          return result;
        };
        try {
          proto.onUseSkill = wrapped;
          state.origUseSkill = original;
          state.useSkillWrapper = wrapped;
        } catch (_) {}
      }
    }

    for (const name of ['onPlayEnterEffect', 'PlayDebutEffect', 'PlayDebutEffect2', 'seat_Debut', 'playSpecialGeneralEffect', 'playJiaXuEffect']) {
      if (state.extra.some(pair => pair.name === name)) continue;
      const original = safe(() => proto[name], null);
      if (typeof original !== 'function') continue;
      const wrapped = function () {
        const self = isSelfPlayerSeat(this.seat);
        if (!self && settings.blockOtherSkinEffects) {
          noteBlock(name, this.seat, 'skin');
          return undefined;
        }
        if (!self && settings.blockOtherVoice) {
          runtime.voiceMute = true;
          try {
            return original.apply(this, arguments);
          } finally {
            runtime.voiceMute = false;
          }
        }
        return original.apply(this, arguments);
      };
      try {
        proto[name] = wrapped;
        state.extra.push({ name, original, wrapper: wrapped });
      } catch (_) {}
    }
  }

  function hookSkinEffect() {
    const mgr = findGameManager();
    if (!mgr) return;
    const managerProto = safe(() => mgr.constructor && mgr.constructor.prototype, null);
    let managerState = runtime.managerProtoState.get(managerProto);
    if (!managerState) {
      managerState = { original: null, wrapper: null };
      runtime.managerProtoState.set(managerProto, managerState);
    }
    if (!managerState.original) {
      const original = safe(() => managerProto && managerProto.onNotifyPlayDynamicSkinEffect, null);
      if (typeof original === 'function') {
        const wrapped = function (e) {
          try {
            if (settings.blockOtherSkinEffects) {
              const seatID = e && e.Protocol && e.Protocol.ProtoData && e.Protocol.ProtoData.seatID;
              if (seatID != null && !isSelfSeat(seatID)) return undefined;
            }
          } catch (_) {}
          return original.apply(this, arguments);
        };
        try {
          managerProto.onNotifyPlayDynamicSkinEffect = wrapped;
          managerState.original = original;
          managerState.wrapper = wrapped;
          runtime.skinPatched = true;
        } catch (_) {}
      }
    }
    if (managerState.original && managerState.wrapper) {
      const proxy = safe(() => mgr.proxy, null);
      let replaced = replaceBoundListener(proxy, managerState.original, managerState.wrapper, mgr) || replaceBoundListener(proxy, managerState.original, managerState.wrapper);
      if (!replaced) {
        for (const key of Object.keys(mgr)) {
          const candidate = safe(() => mgr[key], null);
          if (candidate && candidate._events && replaceBoundListener(candidate, managerState.original, managerState.wrapper, mgr)) {
            replaced = true;
            break;
          }
        }
      }
    }

    for (const seat of managerSeats(mgr)) {
      const seatProto = safe(() => seat.constructor && seat.constructor.prototype, null);
      patchSeatVoicePrototype(seatProto);
      const ui = safe(() => seat.SeatUI, null);
      const uiProto = safe(() => ui && ui.constructor && ui.constructor.prototype, null);
      patchSeatUiPrototype(uiProto);
      if (settings.blockOtherSkinEffects && ui && !isSelfPlayerSeat(seat)) {
        if (ui.skinEmojiEffect) {
          safe(() => ui.skinEmojiEffect.destroy());
          ui.skinEmojiEffect = null;
        }
        const specialEffect = ui.specialSkinSkillEffect;
        if (specialEffect && (specialEffect.IsPlaying || specialEffect.isPlaying)) {
          safe(() => specialEffect.clearLastEffect());
          safe(() => specialEffect.destroy());
          ui.specialSkinSkillEffect = null;
        }
      }
      const uiState = uiProto && runtime.seatUiState.get(uiProto);
      if (uiState) {
        if (uiState.origDynamic && uiState.dynamicWrapper) {
          replaceBoundListener(seat, uiState.origDynamic, uiState.dynamicWrapper, ui);
          replaceBoundListener(ui, uiState.origDynamic, uiState.dynamicWrapper, ui);
        }
        if (uiState.origUseSkill && uiState.useSkillWrapper) {
          replaceBoundListener(seat, uiState.origUseSkill, uiState.useSkillWrapper, ui);
          replaceBoundListener(ui, uiState.origUseSkill, uiState.useSkillWrapper, ui);
        }
        for (const pair of uiState.extra || []) {
          if (!pair.original || !pair.wrapper) continue;
          replaceBoundListener(seat, pair.original, pair.wrapper, ui);
          replaceBoundListener(ui, pair.original, pair.wrapper, ui);
        }
      }
    }
  }

  function applyVoicePolicy(force) {
    const J = window.__JND;
    if (!J || typeof J.setSkinPhraseHearOthersEnabled !== 'function') return;
    const policy = safe(() => J.SkinPhrasePolicy && J.SkinPhrasePolicy.get && J.SkinPhrasePolicy.get(), null);
    if (!settings.blockOtherVoice) {
      if (policy && policy.hearOthersEnabled === false) safe(() => J.setSkinPhraseHearOthersEnabled(true));
      return;
    }
    if (force || (policy && policy.hearOthersEnabled !== false)) {
      safe(() => J.setSkinPhraseHearOthersEnabled(false));
    }
  }

  function runtimeTick() {
    hookChatManager();
    hookSoundManager();
    hookSkinEffect();
    if (inGame()) applyVoicePolicy(false);
  }
  const sound = {
    rows: [],
    rowByKey: new Map(),
    loaded: false,
    loading: false,
    promise: null,
    catalogKey: '',
    catalog: null,
    generalHeadSkin: new Map(),
    searchCache: new Map(),
    error: '',
    query: '',
    statusEls: [],
  };

  const skillNameCache = new Map();
  const headUrlCache = new Map();

  function resolveSkillName(skillId) {
    const id = Number(skillId);
    if (!id) return '';
    if (skillNameCache.has(id)) return skillNameCache.get(id);
    let name = '';
    const J = window.__JND;
    if (J && typeof J.resolveSpellName === 'function') name = safe(() => J.resolveSpellName(id), '') || '';
    skillNameCache.set(id, name);
    return name;
  }

  function currentSelfGeneralId() {
    const mgr = findGameManager();
    const seat = mgr && safe(() => (typeof mgr.SelfSeat === 'function' ? mgr.SelfSeat() : mgr.seats && mgr.seats[mgr.selfSeatIndex]), null);
    if (!seat) return 0;
    const direct = safe(() => seat.GeneralId ?? seat.GeneralID ?? seat.generalId, null);
    if (direct != null && Number(direct)) return Number(direct);
    const general = safe(() => seat.General || seat.general, null);
    const id = safe(() => general && (general.ID ?? general.Id ?? general.id ?? general.GeneralID ?? general.GeneralId), null);
    return Number(id) || 0;
  }

  function currentSelfSkinId() {
    const mgr = findGameManager();
    const seat = mgr && safe(() => (typeof mgr.SelfSeat === 'function' ? mgr.SelfSeat() : mgr.seats && mgr.seats[mgr.selfSeatIndex]), null);
    if (!seat) return 0;
    return Number(seat.SkinID || seat.SkinItemID || seat.Skin2ID || 0) || 0;
  }

  function descriptorUrl(descriptor) {
    if (!descriptor) return '';
    if (typeof descriptor === 'string') return descriptor;
    const candidates = [
      descriptor.url,
      descriptor.headUrl,
      descriptor.headURL,
      descriptor.src,
      descriptor.path,
      descriptor.textureUrl,
      descriptor.texture && (descriptor.texture.url || descriptor.texture._url),
      descriptor.head && (descriptor.head.url || descriptor.head.src),
      descriptor.descriptor && (descriptor.descriptor.url || descriptor.descriptor.src),
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value) return value;
    }
    return '';
  }

  function generalHeadUrls(generalId, skinId) {
    const id = Number(generalId);
    const sid = Number(skinId);
    if (!id && !sid) return [];
    const cacheKey = `${id}|${sid}`;
    if (headUrlCache.has(cacheKey)) return headUrlCache.get(cacheKey);
    const urls = [];
    const add = value => {
      if (value == null || value === '') return;
      let url = '';
      try {
        if (typeof value === 'string' && /^(https?:|res\/)/i.test(value)) {
          url = new URL(value, location.href).href;
        } else {
          const resource = String(value);
          if (!/^\d+$/.test(resource)) return;
          url = new URL(`res/assets/runtime/general/head/${resource}.png`, location.href).href;
        }
      } catch (_) {
        return;
      }
      if (url && !urls.includes(url)) urls.push(url);
    };

    const cat = sound.catalog;
    if (sid) {
      add(sid);
      const item = cat && cat.skinItem && cat.skinItem[sid];
      const relation = cat && cat.skinRelation;
      if (relation) {
        add(relation[sid]);
        if (item) add(relation[item]);
      }
      const reverse = cat && cat.reverseSkinRelation;
      if (reverse) {
        add(reverse[sid]);
        if (item) add(reverse[item]);
      }
    }

    const J = window.__JND;
    if (id && J && typeof J.getGeneralHeadDescriptor === 'function') {
      const descriptor = safe(() => J.getGeneralHeadDescriptor(id), null);
      add(descriptorUrl(descriptor));
    }
    if (id && cat && cat.defaultSkin && cat.defaultSkin[id]) add(cat.defaultSkin[id]);
    if (id && sound.generalHeadSkin.has(id)) add(sound.generalHeadSkin.get(id));

    headUrlCache.set(cacheKey, urls);
    return urls;
  }

  function resolveVoiceUrl(tag, soundKey) {
    const key = String(soundKey || '').trim();
    if (!key) return '';
    if (/^(https?:|res\/)/i.test(key)) {
      try { return new URL(key, location.href).href; } catch (_) { return key; }
    }
    const name = key.replace(/\.(mp3|wav|ogg)$/i, '');
    const tagValue = String(tag || '').trim();
    const dir = tagValue
      ? `res/assets/runtime/voice/skin/${tagValue}/`
      : 'res/assets/runtime/voice/spell/';
    try {
      return new URL(`${dir}${name}.mp3`, location.href).href;
    } catch (_) {
      return '';
    }
  }

  function findCatalogKey() {
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && key.indexOf('jnd:skin-config-catalog:v18:') === 0 && key.indexOf(':latest') === -1) return key;
    }
    return '';
  }

  async function gunzipBase64(text) {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  }

  function prepareSoundRow(row) {
    if (!row) return row;
    row.generalLower = String(row.general || '').toLowerCase();
    row.skinLower = String(row.skin || '').toLowerCase();
    row.skillLower = String(row.skill || '').toLowerCase();
    row.textLower = String(row.text || '').toLowerCase();
    row.tagLower = String(row.tag || '').toLowerCase();
    row.hay = `${row.textLower} ${row.generalLower} ${row.skinLower} ${row.skillLower} ${row.tagLower}`;
    return row;
  }

  function buildSoundIndex(cat) {
    const rows = [];
    const seen = new Set();
    const generalName = cat.generalName || {};
    const skinItem = cat.skinItem || {};
    const skinSearchKey = cat.skinSearchKey || {};
    const itemName = cat.itemName || {};
    const skinGenerals = cat.skinGenerals || {};
    const defaultSkin = cat.defaultSkin || {};
    const chatMap = cat.skinChatPhrase || {};
    const generalHeadSkin = new Map();

    sound.catalog = cat;
    sound.generalHeadSkin = generalHeadSkin;
    headUrlCache.clear();
    for (const skinId of Object.keys(skinGenerals)) {
      const gids = skinGenerals[skinId];
      if (!Array.isArray(gids)) continue;
      for (const gid of gids) {
        const generalId = Number(gid);
        if (generalId && !generalHeadSkin.has(generalId)) generalHeadSkin.set(generalId, Number(skinId));
      }
    }
    for (const gid of Object.keys(defaultSkin)) {
      const generalId = Number(gid);
      const skinId = Number(defaultSkin[gid]);
      if (generalId && skinId) generalHeadSkin.set(generalId, skinId);
    }

    const nameOf = id => generalName[id] || '';
    const skinOf = skinId => {
      const item = skinItem[skinId];
      const searchKey = skinSearchKey[item];
      if (searchKey) {
        const parts = String(searchKey).split('*');
        if (parts[0]) return parts[0];
      }
      return itemName[item] || '';
    };

    for (const skinId of Object.keys(chatMap)) {
      const entries = chatMap[skinId];
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (!Array.isArray(entry)) continue;
        const gids = Array.isArray(entry[0]) ? entry[0] : [];
        const resolvedGids = gids.length ? gids : (Array.isArray(skinGenerals[skinId]) ? skinGenerals[skinId] : []);
        const generalId = Number(resolvedGids[0]) || 0;
        const skillId = Number(entry[1]) || 0;
        const tag = String(entry[4] || '');
        const confId = Number(entry[3]) || 0;
        const texts = entry[5];
        if (!confId || !Array.isArray(texts)) continue;
        let general = resolvedGids.map(nameOf).filter(Boolean).join('、');
        const skin = skinOf(skinId);
        const skill = resolveSkillName(skillId);
        for (const item of texts) {
          if (!Array.isArray(item)) continue;
          const index = Number(item[0]);
          const phrase = String(item[1] || '').trim();
          const soundUrl = String(item[2] || '');
          if (!phrase) continue;
          const key = `${confId}_${index}`;
          if (seen.has(key)) continue;
          seen.add(key);
          rows.push(prepareSoundRow({
            key,
            text: phrase,
            general,
            generalId,
            skinId: Number(skinId),
            skin,
            skillId,
            skill,
            tag,
            sound: soundUrl,
            source: 'catalog',
          }));
        }
      }
    }

    sound.rows = rows;
    sound.rowByKey = new Map(rows.map(row => [row.key, row]));
    sound.searchCache.clear();
    sound.loaded = true;
    sound.loading = false;
    sound.error = '';
    sound.catalogKey = findCatalogKey();
    updateSoundStatus();
    return rows;
  }

  function buildRuntimeIndex() {
    const rows = [];
    const seen = new Set();
    const J = window.__JND;
    const mgr = findGameManager();
    const selfSeat = mgr && safe(() => (typeof mgr.SelfSeat === 'function' ? mgr.SelfSeat() : mgr.seats && mgr.seats[mgr.selfSeatIndex]), null);
    const general = selfSeat && safe(() => {
      const g = selfSeat.General || selfSeat.general;
      return g && (g.GeneralName || g.generalName || g.Name || g.name || g.ShortName) || '';
    }, '');
    const selfGeneralId = currentSelfGeneralId();
    const selfSkinId = currentSelfSkinId();

    const add = (key, text, extra) => {
      if (!key || !text) return;
      const k = String(key);
      if (seen.has(k)) return;
      seen.add(k);
      const row = Object.assign({ key: k, text: String(text), general: String(extra && extra.general || general || ''), skin: String(extra && extra.skin || ''), skill: String(extra && extra.skill || ''), skillId: Number(extra && extra.skillId) || 0, tag: '', sound: '', source: 'runtime' }, extra || {});
      row.generalId = Number(row.generalId) || selfGeneralId || 0;
      row.skinId = Number(row.skinId) || selfSkinId || 0;
      rows.push(prepareSoundRow(row));
    };

    const diag = J && typeof J.inspectInGameSkinPhrases === 'function' ? safe(() => J.inspectInGameSkinPhrases(), null) : null;
    if (diag) {
      const harvest = item => {
        if (!item || typeof item !== 'object') return;
        const key = item.skinChatPhraseKey || item.phraseKey || item.key || (item.phraseRow && (item.phraseRow.skinChatPhraseKey || item.phraseRow.key));
        const text = item.dialog || item.msg || item.message || item.text || item.Msg || (item.phraseRow && (item.phraseRow.dialog || item.phraseRow.msg || item.phraseRow.text));
        if (key && text) add(key, text, { general: item.generalName || item.general, generalId: item.generalId || item.generalID || (Array.isArray(item.generalIds) ? item.generalIds[0] : 0), skinId: item.skinId || item.skinItemId, skin: item.skinName, skill: item.skillName, skillId: item.skillId });
      };
      (diag.eligibleRows || []).forEach(harvest);
      (diag.slotCandidates || []).forEach(candidate => {
        if (!candidate || typeof candidate !== 'object') return;
        (candidate.rows || candidate.phrases || candidate.items || []).forEach(harvest);
        harvest(candidate);
      });
      (diag.view && diag.view.officialNodes || []).forEach(item => harvest(item));
    }

    const qcv = findNode(stage(), 'QuickChatTextView');
    if (qcv && Array.isArray(qcv.itemUIs)) {
      for (const item of qcv.itemUIs) {
        const data = item && item.data;
        if (!data || Number(data.ChatType) !== 52) continue;
        add(data.SkinChatPhraseKey, data.Msg, { general, generalId: selfGeneralId, skinId: selfSkinId, skillId: data.SkillID, skill: resolveSkillName(data.SkillID), sound: data.Sound });
      }
    }

    return rows;
  }

  function ensureSoundIndex() {
    if (sound.loaded) return Promise.resolve(sound.rows);
    if (sound.loading) return sound.promise || Promise.resolve(sound.rows);
    const key = findCatalogKey();
    if (key && sound.catalogKey === key && sound.rows.length) {
      sound.loaded = true;
      return Promise.resolve(sound.rows);
    }
    sound.loading = true;
    sound.error = '';
    updateSoundStatus();
    sound.promise = (async () => {
      try {
        if (!key) throw new Error('未找到锦囊袋台词目录');
        const record = JSON.parse(localStorage.getItem(key) || '{}');
        let json;
        if (record.encoding === 'gzip-base64-v1' && record.data) {
          json = await gunzipBase64(record.data);
        } else if (typeof record.data === 'string') {
          json = record.data;
        } else {
          throw new Error('台词目录格式未知');
        }
        const parsed = JSON.parse(json);
        const cat = parsed.catalog || parsed;
        if (!cat || !cat.skinChatPhrase) throw new Error('台词目录缺少字段');
        buildSoundIndex(cat);
      } catch (error) {
        sound.error = error && error.message ? error.message : String(error);
        const fallback = buildRuntimeIndex();
        if (fallback.length) {
          sound.rows = fallback;
          sound.rowByKey = new Map(fallback.map(row => [row.key, row]));
          sound.loaded = true;
          sound.error = '';
        }
      } finally {
        sound.loading = false;
        sound.promise = null;
        updateSoundStatus();
        refreshSoundContainers();
      }
      return sound.rows;
    })();
    return sound.promise;
  }

  function refreshSoundContainers() {
    if (!sound.loaded) return;
    for (const el of document.querySelectorAll('.sgs-syn-results')) {
      if (el.__sgsSynQuery == null) continue;
      const kind = el.__sgsSynLimitKind || 'panel';
      renderSoundResults(el, el.__sgsSynQuery, getResultLimit(kind));
    }
  }

  function updateSoundStatus() {
    const text = sound.loading
      ? '台词库读取中…'
      : sound.loaded
        ? `台词库：${sound.rows.length} 条`
        : sound.error
          ? `台词库不可用：${sound.error}`
          : '台词库未载入';
    for (const el of sound.statusEls) {
      if (el) el.textContent = text;
    }
  }

  function searchSound(query, limit) {
    const raw = String(query || '').trim().toLowerCase();
    const tokens = raw.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) || [];
    if (!tokens.length) {
      return { list: sound.rows.slice(0, limit), total: sound.rows.length };
    }
    const cached = sound.searchCache.get(raw);
    if (cached) {
      return { list: cached.rows.slice(0, limit), total: cached.total };
    }
    const scored = [];
    for (const row of sound.rows) {
      if (!row.hay) prepareSoundRow(row);
      if (!tokens.every(token => row.hay.indexOf(token) !== -1)) continue;
      const general = row.generalLower;
      const skin = row.skinLower;
      const skill = row.skillLower;
      const text = row.textLower;
      const tag = row.tagLower;
      let score = 0;
      for (const token of tokens) {
        if (general === token) score += 1400;
        else if (general.indexOf(token) !== -1) score += 1000;
        if (skin.indexOf(token) !== -1) score += 280;
        if (skill.indexOf(token) !== -1) score += 240;
        if (text.indexOf(token) !== -1) score += 60;
        if (tag.indexOf(token) !== -1) score += 20;
      }
      if (general && general.indexOf(raw) !== -1) score += 700;
      if (skin && skin.indexOf(raw) !== -1) score += 160;
      scored.push({ row, score });
    }
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const byGeneral = a.row.general.localeCompare(b.row.general, 'zh-Hans-CN');
      if (byGeneral !== 0) return byGeneral;
      return a.row.text.localeCompare(b.row.text, 'zh-Hans-CN');
    });
    const top = scored.slice(0, Math.min(200, scored.length)).map(item => item.row);
    sound.searchCache.set(raw, { rows: top, total: scored.length });
    if (sound.searchCache.size > 12) {
      const oldest = sound.searchCache.keys().next().value;
      sound.searchCache.delete(oldest);
    }
    return { list: top.slice(0, limit), total: scored.length };
  }

  function renderSoundResults(container, query, limit) {
    if (!container) return;
    container.__sgsSynQuery = query;
    container.__sgsSynLimit = limit;
    if (!sound.loaded && !sound.loading) {
      ensureSoundIndex().then(() => renderSoundResults(container, query, limit));
      container.innerHTML = '<div class="sgs-syn-empty">正在读取锦囊袋台词目录…</div>';
      return;
    }
    if (sound.loading) {
      container.innerHTML = '<div class="sgs-syn-empty">正在读取锦囊袋台词目录…</div>';
      return;
    }
    if (!sound.rows.length) {
      container.innerHTML = `<div class="sgs-syn-empty">${escapeHtml(sound.error || '暂时没有可用的台词，请先进入牌局。')}</div>`;
      return;
    }
    const result = searchSound(query, limit);
    container.__sgsSynTotal = result.total;
    const totalEl = container.parentElement && container.parentElement.querySelector('[data-sgs-syn-limit-total]');
    if (totalEl) totalEl.textContent = String(result.total);
    if (!result.list.length) {
      container.innerHTML = '<div class="sgs-syn-empty">没有匹配的台词，换个武将名或台词关键词试试。</div>';
      return;
    }
    const html = result.list.map(row => {
      const general = row.general ? `<b>${escapeHtml(row.general)}</b>` : '';
      const skin = row.skin ? `<i>${escapeHtml(row.skin)}</i>` : '';
      const skill = row.skill ? `<em>[${escapeHtml(row.skill)}]</em>` : '';
      const heads = generalHeadUrls(row.generalId, row.skinId);
      const avatar = heads.length
        ? `<img class="sgs-syn-phrase-avatar" src="${escapeHtml(heads[0])}" alt="" loading="lazy" data-sgs-syn-head="${row.generalId || 0}" data-sgs-syn-head-index="0" data-sgs-syn-head-urls="${escapeHtml(JSON.stringify(heads))}">`
        : '';
      return `<button type="button" class="sgs-syn-phrase" data-sgs-syn-key="${escapeHtml(row.key)}" title="点击发送这句台词">` +
        `<span class="sgs-syn-phrase-main"><span class="sgs-syn-phrase-text">${escapeHtml(row.text)}</span>` +
        `<span class="sgs-syn-phrase-meta">${general}${skin}${skill}</span></span>` +
        avatar +
        '</button>';
    }).join('');
    container.innerHTML = html;
    for (const img of container.querySelectorAll('img.sgs-syn-phrase-avatar')) {
      const onError = () => {
        let urls = [];
        try { urls = JSON.parse(img.getAttribute('data-sgs-syn-head-urls') || '[]'); } catch (_) {}
        const next = Number(img.getAttribute('data-sgs-syn-head-index') || 0) + 1;
        if (Array.isArray(urls) && next < urls.length) {
          img.setAttribute('data-sgs-syn-head-index', String(next));
          img.src = urls[next];
          return;
        }
        img.removeEventListener('error', onError);
        img.remove();
      };
      img.addEventListener('error', onError);
    }
  }

  function bindSoundResults(container, isPanel) {
    if (!container || container.__sgsSynBound) return;
    container.__sgsSynBound = true;
    container.__sgsSynLimitKind = container.closest && container.closest('.sgs-syn-modal') ? 'modal' : 'panel';
    container.addEventListener('click', event => {
      const button = event.target && event.target.closest && event.target.closest('.sgs-syn-phrase');
      if (!button) return;
      event.preventDefault();
      const key = button.getAttribute('data-sgs-syn-key');
      const row = sound.rowByKey.get(key);
      sendSoundRow(row, isPanel);
    });
  }

  function showSendSuccess(row) {
    toast(`已发送：${row.text.slice(0, 24)}`);
  }

  function playLocalPhrase(row) {
    if (!row) return;
    const url = row.voiceUrl || resolveVoiceUrl(row.tag, row.sound);
    if (!url) {
      toast('这条台词没有可试听的音频');
      return;
    }
    try {
      const Laya = window.Laya;
      if (!Laya || !Laya.SoundManager || typeof Laya.SoundManager.playSound !== 'function') {
        toast('当前环境无法播放音频');
        return;
      }
      Laya.SoundManager.playSound(url, 1, null);
      toast(`试听：${row.text.slice(0, 24)}`);
    } catch (error) {
      toast(`试听失败：${error && error.message || error}`);
    }
  }

  function sendSoundRow(row, fromPanel) {
    if (!row) return;
    if (!inGame()) {
      playLocalPhrase(row);
      return;
    }
    const J = window.__JND;
    if (J && jinnangSoundAvailable()) {
      try {
        const result = J.sendOfficialSkinPhrase(row.key);
        const finish = res => {
          if (res && res.ok) {
            showSendSuccess(row);
          } else {
            const reason = res && (res.reason || res.message) || '未知原因';
            toast(`发送失败：${reason}`);
          }
        };
        if (result && typeof result.then === 'function') {
          result.then(finish).catch(error => toast(`发送失败：${error && error.message || error}`));
        } else {
          finish(result);
        }
        return;
      } catch (_) {}
    }
    const chatManager = findChatManager(true, true);
    if (chatManager && typeof chatManager.SendSkinChatPhrase === 'function') {
      try {
        chatManager.SendSkinChatPhrase(row.key);
        showSendSuccess(row);
        return;
      } catch (error) {
        toast(`发送失败：${error && error.message || error}`);
        return;
      }
    }
    toast('当前没有可用的台词发送通道，大厅里点击可以试听。');
  }

  function ensureSoundModal() {
    if (document.getElementById(MODAL_ID) || !document.body) return;
    const modal = document.createElement('div');
    modal.id = MODAL_ID;
    modal.className = 'sgs-syn-modal';
    modal.innerHTML = `
      <div class="sgs-syn-modal-backdrop" data-sgs-syn-close="1"></div>
      <div class="sgs-syn-modal-card" role="dialog" aria-modal="true" aria-label="台词搜索">
        <div class="sgs-syn-modal-head">
          <span class="sgs-syn-modal-title">台词搜索</span>
          <span class="sgs-syn-modal-sub">/sound</span>
          <span class="sgs-syn-count" id="sgs-syn-modal-status" style="margin-left:8px"></span>
          <button type="button" class="sgs-syn-modal-close" data-sgs-syn-close="1" aria-label="关闭">×</button>
        </div>
        <div class="sgs-syn-modal-body">
          <div class="sgs-syn-search-row">
            <input class="sgs-syn-input" id="sgs-syn-modal-input" type="text" spellcheck="false" autocomplete="off" placeholder="搜索台词或武将名，例如：仁德 刘备 / 画入我眸">
            <button type="button" class="sgs-syn-btn" id="sgs-syn-modal-search">搜索</button>
          </div>
          <div class="sgs-syn-hint">点击任意一句即可发送；输入框内按 Enter 会发送第一条结果。</div>
          ${limitRowHtml('modal')}
          <div class="sgs-syn-results sgs-syn-modal-results" id="sgs-syn-modal-results"></div>
        </div>
        <div class="sgs-syn-modal-foot">数据来自锦囊袋皮肤台词目录 · 发送依赖「牌局台词发送」</div>
      </div>
    `;
    document.body.appendChild(modal);
    const input = modal.querySelector('#sgs-syn-modal-input');
    const results = modal.querySelector('#sgs-syn-modal-results');
    const status = modal.querySelector('#sgs-syn-modal-status');
    sound.statusEls.push(status);
    bindSoundResults(results, false);
    bindLimitInput(modal);
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup', 'mousedown', 'pointerdown', 'input', 'compositionstart', 'compositionend']) {
      input.addEventListener(type, stop);
    }
    input.addEventListener('input', () => {
      sound.query = input.value;
      renderSoundResults(results, sound.query, getResultLimit('modal'));
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const first = results.querySelector('.sgs-syn-phrase');
      if (first) first.click();
    });
    modal.querySelector('#sgs-syn-modal-search').addEventListener('click', () => renderSoundResults(results, input.value, getResultLimit('modal')));
    modal.addEventListener('click', event => {
      const target = event.target;
      if (target && target.getAttribute && target.getAttribute('data-sgs-syn-close')) closeSoundModal();
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) closeSoundModal();
    }, true);
    updateSoundStatus();
  }

  function openSoundModal(query) {
    ensureSoundModal();
    const modal = document.getElementById(MODAL_ID);
    if (!modal) return;
    const input = modal.querySelector('#sgs-syn-modal-input');
    const results = modal.querySelector('#sgs-syn-modal-results');
    modal.classList.add('is-open');
    if (input) {
      input.value = query || '';
      sound.query = input.value;
      setTimeout(() => input.focus(), 30);
    }
    ensureSoundIndex().then(() => renderSoundResults(results, sound.query, getResultLimit('modal')));
    renderSoundResults(results, sound.query, getResultLimit('modal'));
  }

  function closeSoundModal() {
    const modal = document.getElementById(MODAL_ID);
    if (modal) modal.classList.remove('is-open');
  }
  const panelUi = {
    mounted: false,
    tab: null,
    pane: null,
    boundSidebar: null,
    startAt: Date.now(),
  };

  function toggleHtml(key, name, desc, checked) {
    return `<div class="jnd-block"><label class="jnd-opt jnd-opt-switch"><span class="jnd-opt-tx"><span class="jnd-opt-name">${name}</span><span class="jnd-opt-desc">${desc}</span></span><span class="jnd-cm-hit"><input type="checkbox" class="jnd-cm-input" data-sgs-syn="${key}"${checked ? ' checked' : ''} aria-label="${name}"><span class="jnd-cm-ctl" aria-hidden="true"><span class="jnd-cm-on jnd-cm-key">ON</span><span class="jnd-cm-off-label jnd-cm-key">OFF</span></span></span></label></div>`;
  }

  function controlsHtml() {
    const integrated = settings.panelMode !== 'standalone';
    return `
      <div class="sgs-syn-sec"><span>面板设置</span></div>
      <div class="sgs-syn-mode-label">面板形态</div>
      <div class="sgs-syn-seg">
        <button type="button" data-sgs-syn-mode="integrated" class="${integrated ? 'is-active' : ''}">并入锦囊袋</button>
        <button type="button" data-sgs-syn-mode="standalone" class="${integrated ? '' : 'is-active'}">独立面板</button>
      </div>
      <div class="sgs-syn-hotkey-row">
        <span>展开 / 关闭快捷键</span>
        <button type="button" class="sgs-syn-hotkey-btn" data-sgs-syn-hotkey="1">${escapeHtml(settings.hotkey || '未设置')}</button>
        <button type="button" class="sgs-syn-hotkey-clear" data-sgs-syn-hotkey-clear="1">清除</button>
      </div>
      <div class="sgs-syn-sec"><span>界面增强</span></div>
      ${toggleHtml('showcaseSearch', '设置展示搜索', '在「设置展示」窗口标题栏加搜索框，按武将名、皮肤名或拼音过滤。', settings.showcaseSearch)}
      ${toggleHtml('redDotCleaner', '立即去红点与新标', '更快隐藏红点与「新」角标；皮肤、武将界面的「新」会保留。', settings.redDotCleaner)}
      ${toggleHtml('jinnangDot', '锦囊袋圆点入口', '收起时只显示 26px 圆点，点击仍可正常展开锦囊袋。', settings.jinnangDot)}
      <div class="sgs-syn-sec"><span>牌局屏蔽</span></div>
      ${toggleHtml('blockOpponentChat', '屏蔽对手发言', '牌局中隐藏其他玩家发送的普通聊天、快捷短语与表情。', settings.blockOpponentChat)}
      ${toggleHtml('blockOtherSkinEffects', '屏蔽其他人皮肤特效', '其他座位触发皮肤技能特效时，本机不再播放。', settings.blockOtherSkinEffects)}
      ${toggleHtml('blockOtherVoice', '屏蔽其他人武将台词', '不再听到其他玩家的技能语音、死亡语音与武将台词快捷短语。', settings.blockOtherVoice)}
    `;
  }

  function getResultLimit(kind) {
    const key = kind === 'modal' ? 'modalLimit' : 'panelLimit';
    const fallback = kind === 'modal' ? 50 : 10;
    const value = Number(settings[key]);
    if (!Number.isFinite(value) || value <= 0) return fallback;
    return Math.min(200, Math.max(1, Math.round(value)));
  }

  function limitRowHtml(kind) {
    return `<div class="sgs-syn-limit-row"><span>共 <b data-sgs-syn-limit-total>0</b> 条，显示前</span><input class="sgs-syn-limit-input" type="number" min="1" max="200" step="1" value="${getResultLimit(kind)}" data-sgs-syn-limit="1" data-sgs-syn-limit-kind="${kind}" aria-label="显示条数"><span>条</span></div>`;
  }

  function soundBlockHtml(prefix) {
    return `
      <div class="sgs-syn-sec"><span>/sound 台词搜索</span></div>
      <div class="sgs-syn-search-row">
        <input class="sgs-syn-input" id="sgs-syn-${prefix}-input" type="text" spellcheck="false" autocomplete="off" placeholder="搜索台词 / 武将名，例如：仁德 刘备">
        <button type="button" class="sgs-syn-btn" id="sgs-syn-${prefix}-open">打开</button>
      </div>
      <div class="sgs-syn-hint">在牌局聊天框输入 <b>/sound</b> 也能随时呼出。选中台词后点一下即可发送。</div>
      ${limitRowHtml('panel')}
      <div class="sgs-syn-results" id="sgs-syn-${prefix}-results"></div>
    `;
  }

  function bindControlsScope(scope) {
    if (!scope || scope.__sgsSynControlsBound) return;
    scope.__sgsSynControlsBound = true;
    scope.addEventListener('change', event => {
      const input = event.target;
      const key = input && input.getAttribute && input.getAttribute('data-sgs-syn');
      if (!key || !(key in DEFAULTS)) return;
      settings[key] = !!input.checked;
      saveSettings();
      applySetting(key);
      syncToggleUi();
    });
    scope.addEventListener('click', event => {
      const target = event.target && event.target.closest ? event.target : null;
      if (!target) return;
      const modeButton = target.closest('[data-sgs-syn-mode]');
      if (modeButton) {
        event.preventDefault();
        const mode = modeButton.getAttribute('data-sgs-syn-mode');
        if (mode === 'integrated' || mode === 'standalone') {
          settings.panelMode = mode;
          saveSettings();
          applyPanelMode();
          syncToggleUi();
        }
        return;
      }
      const hotkeyButton = target.closest('[data-sgs-syn-hotkey]');
      if (hotkeyButton) {
        event.preventDefault();
        startHotkeyCapture();
        return;
      }
      const hotkeyClear = target.closest('[data-sgs-syn-hotkey-clear]');
      if (hotkeyClear) {
        event.preventDefault();
        settings.hotkey = '';
        saveSettings();
        syncToggleUi();
        toast('面板快捷键已清除');
      }
    });
  }

  function syncLimitInputs() {
    for (const input of document.querySelectorAll('[data-sgs-syn-limit]')) {
      const kind = input.getAttribute('data-sgs-syn-limit-kind') === 'modal' ? 'modal' : 'panel';
      const value = String(getResultLimit(kind));
      if (input.value !== value) input.value = value;
    }
  }

  function bindLimitInput(scope) {
    const input = scope && scope.querySelector('[data-sgs-syn-limit]');
    if (!input || input.__sgsSynLimitBound) return;
    input.__sgsSynLimitBound = true;
    const kind = input.getAttribute('data-sgs-syn-limit-kind') === 'modal' ? 'modal' : 'panel';
    const key = kind === 'modal' ? 'modalLimit' : 'panelLimit';
    const fallback = kind === 'modal' ? 50 : 10;
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup', 'mousedown', 'pointerdown', 'input', 'change']) {
      input.addEventListener(type, stop);
    }
    let timer = 0;
    const apply = (syncAll) => {
      let value = Number(input.value);
      if (!Number.isFinite(value)) value = fallback;
      value = Math.min(200, Math.max(1, Math.round(value)));
      settings[key] = value;
      saveSettings();
      if (syncAll) syncLimitInputs();
      refreshSoundContainers();
    };
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => apply(false), 260);
    });
    input.addEventListener('change', () => {
      clearTimeout(timer);
      apply(true);
    });
    input.addEventListener('blur', () => {
      clearTimeout(timer);
      apply(true);
    });
  }

  function bindSoundScope(scope, prefix, isPanel) {
    const input = scope.querySelector(`#sgs-syn-${prefix}-input`);
    const results = scope.querySelector(`#sgs-syn-${prefix}-results`);
    const open = scope.querySelector(`#sgs-syn-${prefix}-open`);
    if (!input || !results) return;
    if (!results.__sgsSynBound) bindSoundResults(results, isPanel);
    bindLimitInput(scope);
    if (input.__sgsSynSoundBound) return;
    input.__sgsSynSoundBound = true;
    const stop = event => event.stopPropagation();
    for (const type of ['keydown', 'keypress', 'keyup', 'mousedown', 'pointerdown', 'input', 'compositionstart', 'compositionend']) {
      input.addEventListener(type, stop);
    }
    let timer = 0;
    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!sound.loaded) ensureSoundIndex();
        renderSoundResults(results, input.value, getResultLimit('panel'));
      }, 160);
    });
    input.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      const first = results.querySelector('.sgs-syn-phrase');
      if (first) first.click();
    });
    if (open) {
      open.addEventListener('click', () => openSoundModal(input.value || ''));
    }
  }

  function positionIntegratedTab(panel) {
    if (!panel) return;
    const sidebar = panel.querySelector('.jnd-sidebar');
    const tab = document.getElementById(TAB_ID);
    if (!sidebar || !tab) return;
    const channelTab = sidebar.querySelector('.jnd-tab-bottom') || sidebar.querySelector('.jnd-tab[data-pane="channel"]');
    const pluginsTab = sidebar.querySelector('.jnd-tab[data-pane="plugins"]');
    if (!channelTab || !pluginsTab) return;
    sidebar.style.position = 'relative';
    const tabHeight = tab.offsetHeight || 32;
    const pluginsBottom = pluginsTab.offsetTop + pluginsTab.offsetHeight;
    const channelTop = channelTab.offsetTop;
    const centerTop = (pluginsBottom + channelTop) / 2 - tabHeight / 2;
    const top = Math.max(pluginsBottom + 6, Math.min(channelTop - tabHeight - 6, centerTop));
    const left = pluginsTab.offsetLeft;
    const width = pluginsTab.offsetWidth || tab.offsetWidth;
    const style = tab.style;
    if (style.position !== 'absolute') {
      style.position = 'absolute';
      style.zIndex = '4';
    }
    const topPx = `${Math.round(top)}px`;
    const leftPx = `${Math.round(left)}px`;
    const widthPx = `${Math.round(width)}px`;
    if (style.top !== topPx) style.top = topPx;
    if (style.left !== leftPx) style.left = leftPx;
    if (style.width !== widthPx) style.width = widthPx;
  }

  function activateSynTab(panel) {
    const tab = document.getElementById(TAB_ID);
    const pane = document.getElementById(PANE_ID);
    if (!tab || !pane) return;
    positionIntegratedTab(panel);
    for (const item of panel.querySelectorAll('.jnd-tab')) item.classList.toggle('active', item === tab);
    for (const item of panel.querySelectorAll('.jnd-pane')) item.classList.toggle('active', item === pane);
    panel.classList.add('sgs-syn-credits-empty');
    const glider = panel.querySelector('.jnd-tab-glider');
    if (glider) {
      const top = tab.offsetTop + (tab.offsetHeight - glider.offsetHeight) / 2;
      glider.style.transform = `translate3d(0px, ${Math.max(0, Math.round(top))}px, 0px)`;
    }
    const main = pane.querySelector('.jnd-pane-main');
    if (main) main.scrollTop = 0;
    const results = pane.querySelector('#sgs-syn-panel-results');
    if (results) renderSoundResults(results, '', getResultLimit('panel'));
  }

  function ensurePanelNodes(panel) {
    if (!panel) return;
    const sidebar = panel.querySelector('.jnd-sidebar');
    const content = panel.querySelector('.jnd-content');
    if (!sidebar || !content) return;

    let tab = document.getElementById(TAB_ID);
    if (!tab || tab.parentElement !== sidebar) {
      if (tab) tab.remove();
      tab = document.createElement('button');
      tab.id = TAB_ID;
      tab.className = 'jnd-tab';
      tab.type = 'button';
      tab.dataset.pane = 'sgs-synthesize';
      tab.innerHTML = '<span class="jnd-tab-icon"><svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="9.5" ry="5.5"></ellipse></svg></span><span>综合</span>';
      sidebar.appendChild(tab);
    }

    let pane = document.getElementById(PANE_ID);
    if (!pane || pane.parentElement !== content) {
      if (pane) pane.remove();
      pane = document.createElement('section');
      pane.id = PANE_ID;
      pane.className = 'jnd-pane';
      pane.dataset.pane = 'sgs-synthesize';
      pane.innerHTML = `
        <div class="jnd-pane-main jnd-settings-main">
          <div class="jnd-pane-head">
            <h3><span class="jnd-h-ic"><svg viewBox="1.1 1.1 21.8 21.8"><path d="M12 3.5c.9 4.6 2.9 6.6 7.5 7.5-4.6.9-6.6 2.9-7.5 7.5-.9-4.6-2.9-6.6-7.5-7.5 4.6-.9 6.6-2.9 7.5-7.5z"></path><path d="M18.5 16.5v4M16.5 18.5h4"></path></svg></span><span>综合插件</span></h3>
            <span class="sgs-syn-by">by ${AUTHOR} · v${VERSION}</span>
          </div>
          ${soundBlockHtml('panel')}
          ${controlsHtml()}
          <div class="sgs-syn-hint" id="sgs-syn-panel-status" style="margin-top:10px"></div>
        </div>
      `;
      content.appendChild(pane);
    }

    panelUi.tab = tab;
    panelUi.pane = pane;
    bindControlsScope(pane);
    bindSoundScope(pane, 'panel', true);
    sound.statusEls = sound.statusEls.filter(el => el && el.isConnected);
    const panelStatus = pane.querySelector('#sgs-syn-panel-status');
    if (panelStatus && !sound.statusEls.includes(panelStatus)) sound.statusEls.push(panelStatus);
    updateSoundStatus();
    positionIntegratedTab(panel);
    panel.classList.toggle('sgs-syn-credits-empty', pane.classList.contains('active'));

    if (panelUi.boundSidebar !== sidebar) {
      panelUi.boundSidebar = sidebar;
      sidebar.addEventListener('click', event => {
        const target = event.target && event.target.closest && event.target.closest('.jnd-tab');
        if (!target) return;
        if (target.dataset.pane === 'sgs-synthesize') {
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          activateSynTab(panel);
          if (!sound.loaded) ensureSoundIndex();
          return;
        }
        setTimeout(() => {
          const ourTab = document.getElementById(TAB_ID);
          if (ourTab) ourTab.classList.remove('active');
          panel.classList.remove('sgs-syn-credits-empty');
        }, 0);
      }, true);
    }
  }

  function removePanelNodes() {
    const tab = document.getElementById(TAB_ID);
    if (tab) tab.remove();
    const pane = document.getElementById(PANE_ID);
    if (pane) pane.remove();
    panelUi.tab = null;
    panelUi.pane = null;
  }

  function applyPanelMode() {
    if (settings.panelMode === 'standalone') {
      removePanelNodes();
      removeFallbackBall();
      ensureWhiteDot();
      ensureStandalonePanel();
      toggleStandalone(true);
    } else {
      toggleStandalone(false);
      removeWhiteDotAndPanel();
      panelTick();
    }
  }

  function panelTick() {
    if (settings.panelMode === 'standalone') {
      ensureWhiteDot();
      removePanelNodes();
      removeFallbackBall();
      return;
    }
    removeWhiteDotAndPanel();
    const panel = document.getElementById('jnd-panel');
    if (!panel) {
      ensureFallbackBall();
      return;
    }
    removeFallbackBall();
    ensurePanelNodes(panel);
  }

  function removeFallbackBall() {
    const ball = document.getElementById(BALL_ID);
    if (ball) ball.remove();
    const modal = document.getElementById(FLOAT_ID);
    if (modal) modal.remove();
  }

  function clampNumber(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function applyStoredPosition(element, position, defaultLeft, defaultTop) {
    if (!element) return;
    const left = position && Number.isFinite(Number(position.left)) ? Number(position.left) : defaultLeft;
    const top = position && Number.isFinite(Number(position.top)) ? Number(position.top) : defaultTop;
    if (position) {
      element.style.left = `${clampNumber(left, 0, Math.max(0, window.innerWidth - element.offsetWidth))}px`;
      element.style.top = `${clampNumber(top, 0, Math.max(0, window.innerHeight - element.offsetHeight))}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
    }
  }

  function makeWindowDraggable(element, handle, positionKey, onClick, detectClick) {
    if (!element || !handle || handle.__sgsSynDragBound) return;
    handle.__sgsSynDragBound = true;
    let dragging = false;
    let moved = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;
    let pointerId = 0;
    const onMove = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      const dx = event.clientX - startX;
      const dy = event.clientY - startY;
      if (Math.abs(dx) + Math.abs(dy) > 4) {
        moved = true;
        element.classList.add('is-dragging');
      }
      const maxLeft = Math.max(0, window.innerWidth - element.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - element.offsetHeight);
      element.style.left = `${clampNumber(startLeft + dx, 0, maxLeft)}px`;
      element.style.top = `${clampNumber(startTop + dy, 0, maxTop)}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
      event.preventDefault();
    };
    const onUp = event => {
      if (!dragging || event.pointerId !== pointerId) return;
      dragging = false;
      element.classList.remove('is-dragging');
      safe(() => handle.releasePointerCapture(pointerId));
      handle.removeEventListener('pointermove', onMove);
      handle.removeEventListener('pointerup', onUp);
      handle.removeEventListener('pointercancel', onUp);
      if (moved && positionKey) {
        settings[positionKey] = {
          left: Math.round(element.getBoundingClientRect().left),
          top: Math.round(element.getBoundingClientRect().top),
        };
        saveSettings();
      }
      if (detectClick && !moved && typeof onClick === 'function') onClick();
    };
    handle.addEventListener('pointerdown', event => {
      if (event.button !== 0) return;
      if (event.target && event.target.closest && event.target.closest('button[data-sgs-syn-standalone-close]')) return;
      dragging = true;
      moved = false;
      pointerId = event.pointerId;
      const rect = element.getBoundingClientRect();
      startX = event.clientX;
      startY = event.clientY;
      startLeft = rect.left;
      startTop = rect.top;
      element.style.left = `${rect.left}px`;
      element.style.top = `${rect.top}px`;
      element.style.bottom = 'auto';
      element.style.right = 'auto';
      safe(() => handle.setPointerCapture(pointerId));
      handle.addEventListener('pointermove', onMove);
      handle.addEventListener('pointerup', onUp);
      handle.addEventListener('pointercancel', onUp);
      event.preventDefault();
    });
  }

  function ensureWhiteDot() {
    if (!document.body) return;
    let dot = document.getElementById(WHITE_DOT_ID);
    if (!dot) {
      dot = document.createElement('button');
      dot.id = WHITE_DOT_ID;
      dot.type = 'button';
      dot.title = '展开 / 关闭综合面板（可拖动）';
      dot.setAttribute('aria-label', '展开 / 关闭综合面板');
      dot.addEventListener('click', event => {
        if (event.detail === 0) toggleStandalone();
      });
      document.body.appendChild(dot);
    }
    applyStoredPosition(dot, settings.dotPos, 18, window.innerHeight - 148);
    makeWindowDraggable(dot, dot, 'dotPos', () => toggleStandalone(), true);
    dot.style.display = 'block';
    dot.classList.toggle('is-open', uiState.standaloneOpen);
  }

  function removeWhiteDotAndPanel() {
    const dot = document.getElementById(WHITE_DOT_ID);
    if (dot) dot.remove();
    const panel = document.getElementById(STANDALONE_ID);
    if (panel) panel.remove();
    uiState.standaloneOpen = false;
  }

  function ensureStandalonePanel() {
    if (document.getElementById(STANDALONE_ID) || !document.body) return;
    const panel = document.createElement('div');
    panel.id = STANDALONE_ID;
    panel.innerHTML = `
      <div class="sgs-syn-standalone-head">
        <span class="sgs-syn-standalone-title">综合插件</span>
        <span class="sgs-syn-standalone-sub">by ${AUTHOR} · v${VERSION}</span>
        <button type="button" class="sgs-syn-standalone-close" data-sgs-syn-standalone-close="1" aria-label="关闭">×</button>
      </div>
      <div class="sgs-syn-standalone-body">
        ${soundBlockHtml('standalone')}
        ${controlsHtml()}
        <div class="sgs-syn-hint" id="sgs-syn-standalone-status" style="margin-top:10px"></div>
      </div>
    `;
    document.body.appendChild(panel);
    makeWindowDraggable(panel, panel.querySelector('.sgs-syn-standalone-head'), 'panelPos', null, false);
    bindControlsScope(panel);
    bindSoundScope(panel, 'standalone', false);
    const status = panel.querySelector('#sgs-syn-standalone-status');
    if (status) {
      sound.statusEls = sound.statusEls.filter(el => el && el.isConnected);
      if (!sound.statusEls.includes(status)) sound.statusEls.push(status);
      updateSoundStatus();
    }
    panel.addEventListener('click', event => {
      const target = event.target && event.target.closest ? event.target : null;
      if (target && target.closest('[data-sgs-syn-standalone-close]')) toggleStandalone(false);
    });
  }

  function toggleStandalone(force) {
    ensureStandalonePanel();
    const panel = document.getElementById(STANDALONE_ID);
    if (!panel) return;
    const open = force == null ? !panel.classList.contains('is-open') : !!force;
    panel.classList.toggle('is-open', open);
    uiState.standaloneOpen = open;
    const dot = document.getElementById(WHITE_DOT_ID);
    if (dot) dot.classList.toggle('is-open', open);
    if (open) {
      applyStoredPosition(panel, settings.panelPos, 42, window.innerHeight - 148);
      if (!sound.loaded) ensureSoundIndex();
      const results = panel.querySelector('#sgs-syn-standalone-results');
      if (results) renderSoundResults(results, results.__sgsSynQuery || '', getResultLimit('panel'));
    }
  }

  function ensureFallbackBall() {
    if (!document.body || document.getElementById('jnd-panel')) return;
    if (Date.now() - panelUi.startAt < 6000) return;
    if (document.getElementById(BALL_ID)) return;
    const ball = document.createElement('button');
    ball.id = BALL_ID;
    ball.type = 'button';
    ball.title = `综合插件 by ${AUTHOR}`;
    ball.textContent = '综';
    ball.addEventListener('click', openFloatPanel);
    document.body.appendChild(ball);
    requestAnimationFrame(() => { ball.style.display = 'flex'; });
  }

  function ensureFloatModal() {
    if (document.getElementById(FLOAT_ID) || !document.body) return;
    const modal = document.createElement('div');
    modal.id = FLOAT_ID;
    modal.className = 'sgs-syn-modal';
    modal.innerHTML = `
      <div class="sgs-syn-modal-backdrop" data-sgs-syn-float-close="1"></div>
      <div class="sgs-syn-modal-card" role="dialog" aria-modal="true" aria-label="综合插件设置">
        <div class="sgs-syn-modal-head">
          <span class="sgs-syn-modal-title">综合插件</span>
          <span class="sgs-syn-modal-sub">by ${AUTHOR}</span>
          <button type="button" class="sgs-syn-modal-close" data-sgs-syn-float-close="1" aria-label="关闭">×</button>
        </div>
        <div class="sgs-syn-modal-body" style="overflow:auto">
          ${soundBlockHtml('float')}
          ${controlsHtml()}
          <div class="sgs-syn-hint" id="sgs-syn-float-status" style="margin-top:10px"></div>
        </div>
        <div class="sgs-syn-modal-foot">锦囊袋面板出现后会自动切换为侧栏「综合」页。</div>
      </div>
    `;
    document.body.appendChild(modal);
    bindControlsScope(modal);
    bindSoundScope(modal, 'float', false);
    const status = modal.querySelector('#sgs-syn-float-status');
    if (status) {
      sound.statusEls.push(status);
      updateSoundStatus();
    }
    modal.addEventListener('click', event => {
      const target = event.target;
      if (target && target.getAttribute && target.getAttribute('data-sgs-syn-float-close')) modal.classList.remove('is-open');
    });
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && modal.classList.contains('is-open')) modal.classList.remove('is-open');
    }, true);
  }

  function openFloatPanel() {
    ensureFloatModal();
    const modal = document.getElementById(FLOAT_ID);
    if (modal) modal.classList.add('is-open');
    if (!sound.loaded) ensureSoundIndex();
  }

  function syncToggleUi() {
    for (const input of document.querySelectorAll('[data-sgs-syn]')) {
      const key = input.getAttribute('data-sgs-syn');
      if (key in DEFAULTS && input.checked !== !!settings[key]) input.checked = !!settings[key];
    }
    for (const button of document.querySelectorAll('[data-sgs-syn-mode]')) {
      button.classList.toggle('is-active', button.getAttribute('data-sgs-syn-mode') === settings.panelMode);
    }
    for (const button of document.querySelectorAll('[data-sgs-syn-hotkey]')) {
      button.textContent = uiState.capturingHotkey ? '按下快捷键…' : (settings.hotkey || '未设置');
      button.classList.toggle('is-capturing', uiState.capturingHotkey);
    }
  }

  function isModifierKey(key) {
    return /^(Control|Shift|Alt|Meta|AltGraph)$/.test(String(key));
  }

  function normalizeHotkeyKey(key) {
    let value = String(key || '');
    if (value === ' ') return 'Space';
    if (value.length === 1) return value.toUpperCase();
    if (/^F\d{1,2}$/i.test(value)) return value.toUpperCase();
    return value;
  }

  function hotkeyComboFromEvent(event) {
    const parts = [];
    if (event.ctrlKey) parts.push('Ctrl');
    if (event.altKey) parts.push('Alt');
    if (event.shiftKey) parts.push('Shift');
    if (event.metaKey) parts.push('Meta');
    const key = normalizeHotkeyKey(event.key);
    if (!key || isModifierKey(key) || key === '+' || key === '=') return '';
    const isFunctionKey = /^F\d{1,2}$/.test(key);
    if (!parts.length && !isFunctionKey) return '';
    return parts.concat([key]).join('+');
  }

  function hotkeyMatchesEvent(event) {
    if (!settings.hotkey) return false;
    const parts = String(settings.hotkey).split('+');
    const key = parts[parts.length - 1];
    const needCtrl = parts.includes('Ctrl');
    const needAlt = parts.includes('Alt');
    const needShift = parts.includes('Shift');
    const needMeta = parts.includes('Meta');
    return !!event.ctrlKey === needCtrl
      && !!event.altKey === needAlt
      && !!event.shiftKey === needShift
      && !!event.metaKey === needMeta
      && normalizeHotkeyKey(event.key) === key;
  }

  function startHotkeyCapture() {
    uiState.capturingHotkey = true;
    syncToggleUi();
    toast('请按下快捷键组合，Esc 取消，Backspace 清除');
  }

  function togglePanelByHotkey() {
    if (settings.panelMode === 'standalone') {
      toggleStandalone();
      return;
    }
    const panel = document.getElementById('jnd-panel');
    if (!panel) return;
    const open = panel.classList.contains('open') || panel.getAttribute('data-entry-state') === 'expanded';
    if (open) {
      const collapse = panel.querySelector('.jnd-panel-collapse');
      if (collapse) collapse.click();
      return;
    }
    const pips = document.getElementById('sgs-syn-pips');
    if (pips) {
      pips.click();
      return;
    }
    const face = panel.querySelector('.jnd-face-front');
    if (face) face.click();
    else panel.click();
  }

  function handleHotkeyKeydown(event) {
    if (uiState.capturingHotkey) {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (event.key === 'Escape') {
        uiState.capturingHotkey = false;
        syncToggleUi();
        toast('已取消设置快捷键');
        return;
      }
      if (event.key === 'Backspace' || event.key === 'Delete') {
        settings.hotkey = '';
        saveSettings();
        uiState.capturingHotkey = false;
        syncToggleUi();
        toast('面板快捷键已清除');
        return;
      }
      if (isModifierKey(event.key)) return;
      const combo = hotkeyComboFromEvent(event);
      if (!combo) {
        toast('请使用 Ctrl/Alt/Shift + 字母，或 F1-F12');
        return;
      }
      settings.hotkey = combo;
      saveSettings();
      uiState.capturingHotkey = false;
      syncToggleUi();
      toast(`面板快捷键已设为 ${combo}`);
      return;
    }
    if (!settings.hotkey || event.repeat) return;
    if (!hotkeyMatchesEvent(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    togglePanelByHotkey();
  }

  function applySetting(key) {
    if (key === 'showcaseSearch') {
      if (!settings.showcaseSearch) restoreShowcase();
      else showcaseRefresh();
    } else if (key === 'redDotCleaner') {
      redDotSweep();
    } else if (key === 'jinnangDot') {
      dotTick();
    } else if (key === 'blockOtherVoice') {
      applyVoicePolicy(true);
    }
  }
  function hookChatInputs() {
    const rootStage = stage();
    if (!rootStage) return;
    const inputs = [];
    eachNode(rootStage, node => {
      if (/SgsTextInput|TextInput/.test(classOf(node))) inputs.push(node);
    });
    for (const input of inputs) {
      if (input.__sgsSynInputHooked) continue;
      input.__sgsSynInputHooked = true;
      const handler = () => {
        const text = String(safe(() => input.text, '') || '');
        if (!/^\/sound(?:\s|$)/i.test(text.trim())) return;
        const query = text.trim().replace(/^\/sound\s*/i, '');
        safe(() => { input.text = ''; });
        setTimeout(() => openSoundModal(query), 0);
      };
      safe(() => input.on(window.Laya.Event.INPUT, null, handler));
      safe(() => input.on(window.Laya.Event.FOCUS, null, handler));
    }
  }
  function boot() {
    installGlobalCss();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  installGlobalCss();
  document.addEventListener('keydown', handleHotkeyKeydown, true);
  setInterval(() => {
    installGlobalCss();
    if (!document.body) return;
    showcaseTick();
  }, 250);
  setInterval(panelTick, 500);
  setInterval(dotTick, 300);
  setInterval(redDotTick, 400);
  setInterval(runtimeTick, 900);
  setInterval(hookChatInputs, 1200);
  setInterval(() => {
    if (settings.blockOtherVoice && inGame()) applyVoicePolicy(false);
  }, 5000);
  setTimeout(() => ensureFallbackBall(), 6500);
})();
