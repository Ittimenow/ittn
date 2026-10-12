import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';

const source=await readFile(new URL('../src/scripts/idea-erase.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {eraseAt}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));

test('eraser splits a crossed line and keeps distant ink',()=>{
  const horizontal=[{x:0,y:0,p:.6},{x:100,y:0,p:.6}];
  const other=[{x:0,y:50,p:.6},{x:100,y:50,p:.6}];
  const outcome=eraseAt([horizontal,other],{x:50,y:0,p:.6},10);
  assert.equal(outcome.changed,true);
  assert.equal(outcome.strokes.length,3);
  assert.ok(outcome.strokes[0].at(-1).x<50);
  assert.ok(outcome.strokes[1][0].x>50);
  assert.equal(outcome.strokes[2],other);
});

test('eraser outside strokes leaves data untouched',()=>{
  const strokes=[[{x:0,y:0,p:.6},{x:10,y:0,p:.6}]];
  const outcome=eraseAt(strokes,{x:50,y:50,p:.6},5);
  assert.equal(outcome.changed,false);
  assert.equal(outcome.strokes,strokes);
});
