// Common test fixture: set up a jsdom document and expose the globals
// markup-mixup expects (it was originally written as a browser script
// and references `document`, `Element`, `Node`, `NodeList`,
// `HTMLCollection`, `Document`, and `window.document`).

import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');

for (const name of ['window', 'document', 'Node', 'Element',
                   'Document', 'DocumentFragment', 'NodeList',
                   'HTMLCollection', 'XMLSerializer']) {
  globalThis[name] = dom.window[name];
}

// jsdom's `instanceof` realm problem: jsdom objects don't pass
// `instanceof` against a *different* realm's Node/Element. The globals
// above come straight from dom.window, so classes created inside that
// window are consistent, but plain `x instanceof Node` checks in the
// module (which evaluates against globalThis.Node = dom.window.Node)
// still work. Nothing else to do here.

export default dom.window;
export { dom };