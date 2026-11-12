'use strict';
// Aides partagées par app.js et scene.js. Chargé avant les deux.
const $ = id => document.getElementById(id);
const ETATS = { WORK: ['busy', 'working', 'running'], FREE: ['idle', 'done'], WAIT: ['waiting', 'blocked'] };
function bossOf(agents){
  const chosen=agents.find(a=>a.boss===true);
  return chosen&&agents.length>1?chosen:null;
}
