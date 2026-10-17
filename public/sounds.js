// public/sounds.js
// Synthèse sonore 8 bits pour le Bureau des agents (Web Audio API).
// Désactivé par défaut, volume discret (gain <= 0,05), aucun son sans geste utilisateur préalable.
(function () {
  'use strict';

  var STORAGE_KEY = 'bureau.sons';
  var MAX_GAIN = 0.045; // Plafond strict sous 0,05.

  function readPreference() {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'on';
    } catch (_) {
      return false;
    }
  }

  function savePreference(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val ? 'on' : 'off');
    } catch (_) {
      // Ignorer les indisponibilités de stockage.
    }
  }

  var isEnabled = readPreference();
  var audioCtx = null;
  var userInteracted = false;

  function markInteraction() {
    userInteracted = true;
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
  }

  if (typeof window !== 'undefined') {
    ['pointerdown', 'keydown', 'click'].forEach(function (evt) {
      window.addEventListener(evt, markInteraction, { capture: true, once: false, passive: true });
    });
  }

  function getAudioContext() {
    if (!userInteracted) return null;
    if (!audioCtx && typeof window !== 'undefined') {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        try {
          audioCtx = new Ctx();
        } catch (_) {
          audioCtx = null;
        }
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playNotes(ctx, notes, totalGain) {
    var gainVal = Math.min(totalGain || MAX_GAIN, MAX_GAIN);
    var now = ctx.currentTime;
    var master = ctx.createGain();
    master.gain.setValueAtTime(gainVal, now);
    master.connect(ctx.destination);

    notes.forEach(function (n) {
      var freq = n[0];
      var start = now + n[1];
      var dur = n[2];
      var wave = n[3] || 'square';

      var osc = ctx.createOscillator();
      var noteGain = ctx.createGain();

      osc.type = wave;
      osc.frequency.setValueAtTime(freq, start);

      // Enveloppe d'attaque et atténuation rapide pour prévenir tout claquement audio.
      noteGain.gain.setValueAtTime(0.0001, start);
      noteGain.gain.exponentialRampToValueAtTime(1.0, start + 0.012);
      noteGain.gain.setValueAtTime(1.0, start + dur - 0.02);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, start + dur);

      osc.connect(noteGain);
      noteGain.connect(master);

      osc.start(start);
      osc.stop(start + dur + 0.01);
    });
  }

  var SOUNDS = {
    // Fin de travail observée : arpège joyeux court (Do5, Mi5, Sol5 en triangle et carré).
    mail: function (ctx) {
      playNotes(ctx, [
        [523.25, 0.00, 0.07, 'triangle'],
        [659.25, 0.07, 0.07, 'triangle'],
        [783.99, 0.14, 0.12, 'square']
      ], 0.04);
    },

    // Agent en attente de réponse : deux notes montantes nettes (La4 vers Ré5).
    blocked: function (ctx) {
      playNotes(ctx, [
        [440.00, 0.00, 0.10, 'square'],
        [587.33, 0.12, 0.16, 'triangle']
      ], 0.045);
    },

    // Limite ou quota atteint : descente feutrée en ondes triangle (Sol4, Mi4, Do4).
    pause: function (ctx) {
      playNotes(ctx, [
        [392.00, 0.00, 0.11, 'triangle'],
        [329.63, 0.10, 0.11, 'triangle'],
        [261.63, 0.20, 0.16, 'triangle']
      ], 0.035);
    },

    // Ordre délégué par le chef : signal vif en deux temps (Fa4 vers Do5).
    delegation: function (ctx) {
      playNotes(ctx, [
        [349.23, 0.00, 0.08, 'square'],
        [523.25, 0.09, 0.14, 'square']
      ], 0.04);
    }
  };

  var BureauSounds = {
    get enabled() {
      return isEnabled;
    },
    set enabled(val) {
      isEnabled = Boolean(val);
      savePreference(isEnabled);
    },
    setEnabled: function (val) {
      isEnabled = Boolean(val);
      savePreference(isEnabled);
      return isEnabled;
    },
    play: function (kind) {
      if (!isEnabled) return false;
      var ctx = getAudioContext();
      if (!ctx || ctx.state !== 'running') return false;
      var fn = SOUNDS[kind];
      if (typeof fn !== 'function') return false;
      try {
        fn(ctx);
        return true;
      } catch (_) {
        return false;
      }
    }
  };

  if (typeof window !== 'undefined') {
    window.BureauSounds = BureauSounds;
  }
})();
