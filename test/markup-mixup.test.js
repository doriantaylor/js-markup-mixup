// Test suite for markup-mixup.

import './fixtures.js';
import MARKUP from '../markup-mixup.js';
import test from 'node:test';
import assert from 'node:assert/strict';

// fresh body for each test so they don't interfere
test.beforeEach(() => {
  document.body.innerHTML = '';
});

test('appends a text string to a parent', () => {
  const out = MARKUP({ parent: document.body, spec: 'lol' });
  assert.equal(out.nodeType, 3); // text node
  assert.equal(out.textContent, 'lol');
  assert.equal(document.body.lastChild, out);
});

test('generates an element with attributes', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#a': ['duhh ', { '#em': 'durr' }], href: '/derp' } });

  // MARKUP returns the last node in document order — here, the em
  assert.equal(out.localName, 'em');
  assert.equal(out.textContent, 'durr');

  const a = out.parentNode;
  assert.equal(a.localName, 'a');
  assert.equal(a.getAttribute('href'), '/derp');
  assert.equal(a.firstChild.textContent, 'duhh ');
});

test('attachment mode: before', () => {
  MARKUP({ parent: document.body, spec: 'first' });
  const second = MARKUP({ parent: document.body, spec: 'second' });

  const out = MARKUP({ before: second, spec: { '#strong': 'smelling' } });
  // out is the text node; its parent is the strong
  const el = out.parentNode;
  assert.equal(el.localName, 'strong');
  assert.equal(out.textContent, 'smelling');
  assert.equal(second.previousSibling, el);
});

test('attachment mode: after', () => {
  const first = MARKUP({ parent: document.body, spec: 'first' });

  const out = MARKUP({ after: first, spec: { '#strong': 'x' } });
  const el = out.parentNode;
  assert.equal(el.localName, 'strong');
  assert.equal(first.nextSibling, el);
});

test('attachment mode: replace', () => {
  const target = MARKUP({ parent: document.body, spec: 'lol' });

  const out = MARKUP({ replace: target, spec: { '#h1': 'OBTRUSIVE' } });
  const el = out.parentNode;
  assert.equal(el.localName, 'h1');
  assert.equal(out.textContent, 'OBTRUSIVE');
  assert.equal(document.body.lastChild, el);
});

test('generates comments', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#comment': ' this is a comment ' } });

  assert.equal(out.nodeType, 8);
  assert.equal(out.textContent, ' this is a comment ');
});

test('generates CDATA sections (xml document)', () => {
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc, spec: {
    '#cdata': 'some <raw> & text' } });

  assert.equal(out.nodeType, 4);
  assert.equal(out.textContent, 'some <raw> & text');
});

test('generates processing instructions (xml document)', () => {
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc, spec: {
    '#pi': ['target', 'data'], attr: 'value' } });

  assert.equal(out.nodeType, 7);
  assert.equal(out.target, 'target');
  assert.match(out.data, /attr=value/);
  assert.match(out.data, /data/);
});

test('processing instruction with no attributes carries clean data', () => {
  // regression: flatten() stringified the empty attrs object to
  // '[object Object]', so a bare [target, data] PI gained the
  // garbage prefix
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc, spec: {
    '#processing-instruction': ['target', 'data'] } });

  assert.equal(out.nodeType, 7);
  assert.equal(out.target, 'target');
  assert.equal(out.data, 'data');
});

test('a processing instruction without a target throws', () => {
  const doc = document.implementation.createDocument(null, 'root');
  assert.throws(() =>
    MARKUP({ parent: doc.documentElement, doc: doc,
      spec: { '#pi': [] } }), TypeError);
});

test('flatten of an empty object yields the empty string', () => {
  // the attribute-side face of the same regression: an empty
  // object attribute value is '' rather than '[object Object]'
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'x', opts: {} } });
  assert.equal(out.parentNode.getAttribute('opts'), '');
});

test('flattens array attribute values', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'content', classes: ['a', 'b', 'c'] } });

  const el = out.parentNode;
  assert.equal(el.localName, 'div');
  assert.equal(el.getAttribute('classes'), 'a b c');
});

test('flattens object attribute values', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'content', opts: { e: 'f', c: 'd' } } });

  const el = out.parentNode;
  assert.equal(el.getAttribute('opts'), 'c: d e: f');
});

test('callbacks receive args', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'x',
    class: () => 'computed',
    id: (args) => 'id-' + args[0] }, args: ['007'] });

  const el = out.parentNode;
  assert.equal(el.getAttribute('class'), 'computed');
  assert.equal(el.getAttribute('id'), 'id-007');
});

test('attribute callbacks bind this to the first arg', () => {
  const ctx = { marker: 'context-here' };
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'x',
    class: function () { return 'ctx-' + this.marker; },
  }, args: [ctx] });

  assert.equal(out.parentNode.getAttribute('class'), 'ctx-context-here');
});

test('spec-body callbacks bind this to the first arg', () => {
  const ctx = { name: 'world' };
  const out = MARKUP({ parent: document.body, spec: {
    '#div': function () { return 'hello ' + this.name; },
  }, args: [ctx] });

  assert.equal(out.parentNode.textContent, 'hello world');
});

test('callback as spec body', () => {
  // note: spec-level callbacks receive args spread across parameters
  const out = MARKUP({ parent: document.body, spec: {
    '#div': function (...args) { return 'from ' + args.join(''); },
  }, args: ['callback'] });

  const el = out.parentNode;
  assert.equal(el.localName, 'div');
  assert.equal(el.textContent, 'from callback');
});

test('clones existing nodes passed as spec', () => {
  const src = document.createElement('p');
  src.textContent = 'original';
  document.body.appendChild(src);

  MARKUP({ parent: document.body, spec: src });
  const ps = document.body.querySelectorAll('p');
  assert.equal(ps.length, 2);
  assert.equal(ps[1].textContent, 'original');
});

test('handles an array of specs as siblings', () => {
  const out = MARKUP({ parent: document.body, spec: [
    { '#li': 'one' }, { '#li': 'two' }, { '#li': 'three' }] });

  // last node in document order
  assert.equal(out.localName, 'li');
  assert.equal(out.textContent, 'three');
  const lis = document.body.querySelectorAll('li');
  assert.equal(lis.length, 3);
});

test('empty spec array is a no-op', () => {
  const out = MARKUP({ parent: document.body, spec: [] });
  assert.equal(document.body.childNodes.length, 0);
  assert.equal(out, document.body);
});

test('is= attribute is detected and set', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#button': 'go', is: 'fancy-button' } });

  const el = out.parentNode;
  assert.equal(el.localName, 'button');
  assert.equal(el.getAttribute('is'), 'fancy-button');
});

test('is= with a null value is omitted', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#div': 'x', is: null } });

  const el = out.parentNode;
  assert.equal(el.localName, 'div');
  assert.equal(el.getAttribute('is'), null);
});

test('is= with a function value', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#button': 'go', is: () => 'fancy-button' } });

  const el = out.parentNode;
  assert.equal(el.getAttribute('is'), 'fancy-button');
});

test('namespaced element via xmlns attribute', () => {
  const out = MARKUP({ parent: document.body, spec: {
    '#svg': [{ '#circle': null }],
    xmlns: 'http://www.w3.org/2000/svg' } });

  const el = out.parentNode;
  assert.equal(el.localName, 'svg');
  assert.equal(el.getAttribute('xmlns'), 'http://www.w3.org/2000/svg');
});

test('unprefixed #tag elements are created in the target document', () => {
  // regression: ELEMENT fell back to the GLOBAL document for an
  // unbound prefix, relocating the element into the host
  // document's XHTML namespace (and creating it in the wrong
  // document; the DOM silently adopts on append, masking that
  // half). an #tag element with no xmlns must land namespace-less
  // in the document being built into
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc,
    spec: { '#tag': ['section'], id: 's1' } });

  assert.equal(out.localName, 'section');
  assert.equal(out.namespaceURI, null);
  assert.equal(out.ownerDocument, doc);
  assert.equal(out.getAttribute('id'), 's1');
});

test('ordinary elements in an xml document stay namespace-less', () => {
  // the non-#tag face of the same regression: a plain element
  // spec in an xml document must not gain the host document's
  // XHTML namespace
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc,
    spec: { '#entry': 'value' } });

  const el = out.parentNode;
  assert.equal(el.localName, 'entry');
  assert.equal(el.namespaceURI, null);
  assert.equal(el.ownerDocument, doc);
});

test('prefixed #tag elements honour the bound namespace', () => {
  // guard the namespaced side of the #tag path against the
  // fallback fix. the first child of a #tag designator is the
  // tag string; further children are its content
  const doc = document.implementation.createDocument(null, 'root');
  const out = MARKUP({ parent: doc.documentElement, doc: doc, spec: {
    '#tag': ['x:note', 'body'],
    'xmlns:x': 'urn:example:x' } });

  assert.equal(out.nodeType, 3);
  const el = out.parentNode;
  assert.equal(el.nodeName, 'x:note');
  assert.equal(el.namespaceURI, 'urn:example:x');
  assert.equal(el.ownerDocument, doc);
  assert.equal(el.textContent, 'body');
});

test('empty children array yields an empty element', () => {
  const out = MARKUP({ parent: document.body, spec: { '#div': null } });
  assert.equal(out.localName, 'div');
  assert.equal(out.childNodes.length, 0);
});

test('numeric and boolean atoms become strings', () => {
  MARKUP({ parent: document.body, spec: [42, true] });

  assert.ok(document.body.textContent.includes('42'));
  assert.ok(document.body.textContent.includes('true'));
});

test('null and undefined specs produce nothing', () => {
  const out = MARKUP({ parent: document.body, spec: null });
  assert.equal(document.body.childNodes.length, 0);
});

test('positional calling convention: MARKUP(parent, spec)', () => {
  const div = document.createElement('div');
  document.body.appendChild(div);

  const out = MARKUP(div, { '#p': 'positional' });
  // last node in document order is the text node
  assert.equal(out.nodeType, 3);
  assert.equal(out.textContent, 'positional');
  const p = out.parentNode;
  assert.equal(p.localName, 'p');
  assert.equal(div.lastChild, p);
});

test('named and default exports match', async () => {
  const mod = await import('../markup-mixup.js');
  assert.equal(mod.default, mod.MARKUP);
});