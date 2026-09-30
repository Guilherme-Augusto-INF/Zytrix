import test from 'node:test';
import assert from 'node:assert/strict';
import { categories, icons } from '../assets/js/ui.js';

test('expanded category catalog has an icon and subcategories for every category', () => {
  const names=Object.keys(categories);
  assert.ok(names.length >= 16);
  for (const name of names) {
    assert.equal(typeof icons[name],'string');
    assert.ok(icons[name].length > 0);
    assert.ok(Array.isArray(categories[name]));
    assert.ok(categories[name].length >= 7);
  }
});

test('core existing categories remain available', () => {
  for (const name of ['Gaming','Música','Just Chatting','Criatividade','Esportes','Tecnologia','Podcasts','IRL']) {
    assert.ok(categories[name]);
  }
});
