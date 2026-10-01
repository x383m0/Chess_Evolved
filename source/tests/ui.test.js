import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Window } from 'happy-dom';

test('actual UI: legal highlights, turns, checkmate, local restart and draw consent',async()=>{
 const window=new Window({url:'https://example.com/chess/'});
 for(const key of ['window','document','navigator','location','HTMLElement']) Object.defineProperty(globalThis,key,{configurable:true,value:window[key]});
 globalThis.setTimeout = window.setTimeout.bind(window);
 globalThis.clearTimeout = window.clearTimeout.bind(window);
 window.document.body.innerHTML='<div id="app"></div>';
 let source=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 source=source.replace("import './style.css';",'');
 for(const name of ['session','rules','network']) source=source.replace(`'./${name}.js'`,JSON.stringify(new URL(`../src/${name}.js`,import.meta.url).href));
 await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const $=id=>document.getElementById(id),sq=s=>document.querySelector(`[data-square="${s}"]`);
 const move=(f,t)=>{sq(f).click();sq(t).click();};
 assert.equal(document.querySelectorAll('.square').length,64);
 sq('e2').click();assert.ok(sq('e4').classList.contains('legal'));assert.ok(sq('e3').classList.contains('legal'));
 sq('e5').click();assert.match(sq('e2').getAttribute('aria-label'),/White Pawn/);
 move('f2','f3');assert.equal($('turn-label').textContent,'BLACK TO MOVE');
 move('e7','e5');move('g2','g4');move('d8','h4');assert.equal($('game-status').textContent,'Black wins.');assert.equal($('game-detail').textContent,'Checkmate');
 $('rematch').click();assert.equal($('move-count').textContent,'0 moves');
 $('flip').click();assert.equal(document.querySelector('.square').dataset.square,'h1');
 $('draw').click();assert.equal($('draw-response').hidden,false);$('accept-draw').click();assert.equal($('game-detail').textContent,'Draw by agreement');
 $('rematch').click();$('online').click();assert.equal($('online-controls').hidden,false);
 $('room-input').value='bad';$('join').click();assert.equal($('toast').textContent,'Enter the 8-character room code.');
 await window.happyDOM.close();
});
