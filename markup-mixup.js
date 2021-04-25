const MARKUP = (function () {
    // these are all the attachment modes
    const ADJACENT = {
        parent: function (node, parent) {
            // apparently we don't need to give this special
            // consideration for the root etc /shrug
            parent.appendChild(node);
            return parent.lastChild;
        },
        before: function (node, sibling) {
            sibling.parentNode.insertBefore(node, sibling);
            return sibling.previousSibling;
        },
        after: function (node, sibling) {
            if (sibling.nextSibling)
                sibling.parentNode.insertBefore(node, sibling.nextSibling);
            else sibling.parentNode.appendChild(node);
            return sibling.nextSibling;
        },
        replace: function (node, target) {
            // special case for document fragments
            let out = node.nodeType === 11 ? node.lastChild : node;
            let parent = target.parentNode;
            parent.replaceChild(node, target);
            return out || parent;
        }
    };

    // woof, copied from https://www.w3.org/TR/REC-xml/#NT-Name and
    // shuffled slightly to be more amenable to regex character classes
    const NS_CHARS = 'A-Z_a-z\\u{00C0}-\\u{00D6}\\u{00D8}-\\u{00F6}' +
          '\\u{00F8}-\\u{02FF}\\u{0370}-\\u{037D}\\u{037F}-\\u{1FFF}' +
          '\\u{200C}-\\u{200D}\\u{2070}-\\u{218F}\\u{2C00}-\\u{2FEF}' +
          '\\u{3001}-\\u{D7FF}\\u{F900}-\\u{FDCF}\\u{FDF0}-\\u{FFFD}' +
          '\\u{10000}-\\u{EFFFF}';
    const NC_CHARS = '-.0-9' + NS_CHARS +
          '\\u{00B7}\\u{0300}-\\u{036F}\\u{203F}-\\u{2040}';

    const NCN_PAT = '([' + NS_CHARS + '][' + NC_CHARS + ']*)';
    const QN_PAT  = '(?:' + NCN_PAT + ':)?' + NCN_PAT;

    const NCNAME_RE = new RegExp('^' + NCN_PAT + '$', 'u');
    const QNAME_RE  = new RegExp('^' + QN_PAT  + '$', 'u');
    const XMLNS_RE  = new RegExp('^xmlns(?::' + NCN_PAT + ')?$', 'u');

    const IS_TAG = ('# #elem #element #tag').split(' ');
    const RESERVED = (
        '#comment #cdata #doctype #dtd #pi #processing-instruction'
    ).split(' ');

    const ATOMS = ('undefined boolean number string bigint symbol').split(' ');
    const ATOMC = [Number, Date, String, RegExp];

    const XMLNS   = 'http://www.w3.org/XML/1998/namespace';
    const XMLNSNS = 'http://www.w3.org/2000/xmlns/';
    const XHTMLNS = 'http://www.w3.org/1999/xhtml';

    const isTag = function (token) {
        return IS_TAG.some(function (t) { return t === token; });
    };

    const isReserved = function (token) {
        return RESERVED.some(function (t) { return t === token; });
    };

    const isAtom = function (obj) {
        return ATOMS.some(function (t) { return typeof obj === t; }) ||
            ATOMC.some(function (p) { return obj instanceof p; });
    };

    const isArrayLike = function (obj) {
        return obj instanceof Array || obj instanceof NodeList ||
            obj instanceof HTMLCollection;
    };

    const isElemOrDoc = function (obj) {
        if (!obj || !obj.nodeType) return false;
        return [1, 9, 11].some(function (x) { return obj.nodeType === x; });
    };

    const invert = function (obj) {
        let out = {};
        Object.keys(obj).forEach(function (k) { out[obj[k].toString()] = k; });
        return out;
    };

    let gatherNS = function (elem, ns) {
        if (!(elem instanceof Element)) return {};

        ns = ns || {};

        let attr = elem.attributes;

        if (elem.namespaceURI) {
            let pfx = elem.prefix || '';
            if (!(pfx in ns)) ns[pfx] = elem.namespaceURI;
        }

        for (let i = 0; i < attr.length; i++) {
            let a = attr[i];
            let m = /^xmlns(?::(.*?))?$/.exec(a.name);
            if (m) {
                let pfx = m[1] || '';
                if (!(pfx in ns)) ns[pfx] = a.value;
            }
            else if (a.namespaceURI) {
                let pfx = a.prefix || '';
                if (!(pfx in ns)) ns[pfx] = a.namespaceURI;
            }
        }

        elem = elem.parentNode;
        return elem && elem.nodeType === 1 ? gatherNS(elem, ns) : ns;
    };

    const sortAttr = function (a, b) {
        let re = /^xmlns(?::(.*?))?$/;
        let am = re.test(a);
        let bm = re.test(b);
        if (am && !bm) return -1;
        else if (!am && bm) return 1;
        else return a.localeCompare(b); // doesn't really matter but ehh
    };

    const flatten = function (obj, args, kv) {
        if (typeof kv !== 'string') kv = ': ';
        if (obj === null || typeof obj === 'undefined') return undefined;
        if (isAtom(obj) || Object.keys(obj).length === 0) return obj.toString();
        else if (typeof obj === 'function') return flatten(obj(args), args);
        else if (isArrayLike(obj)) {
            let out = [];
            // we do a c style for loop here in case it's something
            // other than an array and doesn't have map
            for (let i = 0; i < obj.length; i++)
                out.push(flatten(obj[i], args));
            return out.join(' ');
        }
        else {
            // here we know it returns an array
            return Object.keys(obj).sort(sortAttr).map(function (k) {
                return k + kv + flatten(obj[k], args); }).join(' ');
        }
    };

    const ELEMENT = function (tag, doc, ns, attr, args) {
        ns = Object.assign({}, ns || {}); // clone
        args = args || []; // default to an array
        if (!(args instanceof Array)) args = [args];

        let pfx  = '';
        let name = null;
        if (isArrayLike(tag)) {
            pfx  = tag[0] || '';
            name = tag[1];
            tag  = tag.slice(0, 2).join(':');
        }
        else {
            tag = tag.toString();
            let m = QNAME_RE.exec(tag);
            pfx = m[1] || '';
        }

        // harvest any new namespace declarations, including overwrites
        Object.keys(attr).forEach(function (k) {
            let m = XMLNS_RE.exec(k);
            // hey, you never know, these could be functions
            if (m) ns[m[1] || ''] = flatten(attr[k], args);
        });

        // create the element
        let elem = ns[pfx] ?
            document.createElementNS(ns[pfx], tag) :
            document.createElement(tag);

        Object.keys(attr).sort(sortAttr).forEach(function (k) {
            let value = flatten(attr[k], args);

            let m = QNAME_RE.exec(k);
            if (!m) return;

            let apfx = m[1] || '';
            let name = m[2];

            if ((!apfx && name === 'xmlns') || apfx === 'xmlns')
                elem.setAttributeNS(XMLNSNS, k, value);
            else if (apfx != '' && apfx in ns)
                elem.setAttributeNS(ns[apfx], k, value);
            else elem.setAttribute(k, value);
        });

        return elem;
    };

    const MARKUP = function MARKUP (parent, spec, args) {
        // the overwhelming majority of operations will be generating
        // the spec under the parent without no callbacks hence no
        // need for args, but we want an alternate calling convention
        // that shoves everything in an object in the first argument 

        let adj  = null;
        let node = null;
        let doc  = null;

        // pseudo-parent in case real parent is not an element
        let pseudo = null;

        if (parent instanceof Node) {
            node = parent;
            doc  = parent.ownerDocument;
            adj  = 'parent';
        }
        else if (typeof parent !== 'object')
            throw 'Not sure what to do with a ' + parent.toString();
        else {
            // 'parent' is actually an object containing named params
            Object.keys(ADJACENT).forEach(function (k) {
                if (parent[k]) {
                    if (adj) throw 'Cannot bind to ' +
                        k + ': ' + adj + ' is already present';
                    if (!(parent[k] instanceof Node))
                        throw parent[k].toString() + ' is not a node';
                    if (!isElemOrDoc(parent[k]))
                        throw k + ' must be a document or element, not ' +
                        parent[k].toString();
                    adj = k;
                }
            });

            // don't forget to set the pseudo-parent if we find one!
            if (parent.pseudo) pseudo = parent.pseudo;

            // spec member overrides spec parameter
            if (parent.spec) {
                // the args are where the spec is
                if (spec instanceof Array) args = spec;

                spec = parent.spec;
            }

            // args member overrides args parameter
            if (parent.args) args = parent.args;

            // coerce args to an array
            if (typeof args === 'undefined') args = [];
            if (!(args instanceof Array)) args = [args];

            // now deal with the adjacent
            if (adj) {
                node = parent[adj];

                // XXX this may not actually make sense
                doc = parent.ownerDocument || parent.doc ||
                    window.document || new Document();

                // we have smuggled all the parts we care about out of
                // this object so we can replace it with the actual
                // parent and not be super confusing
                if (adj === 'parent') parent = parent[adj];
                else if (!parent[adj].parentNode)
                    throw adj + ' node must have a parent node!';
                else parent = parent[adj].parentNode;
            }
            else {
                // new document and parent is the document
                node = parent = doc =
                    parent.doc || window.document || new Document();
                adj = 'parent';
            }
        }

        // make sure this is set
        pseudo = pseudo || parent;

        // okay that was the preamble, hope you liked it

        if (isArrayLike(spec)) {
            // bail out if this list is empty
            if (spec.length <= 0) return node;

            // don't need to screw around with document fragments!
            if (spec.length === 1) {
                let tmp = { spec: spec[0], doc: doc, args: args };
                tmp[adj] = node;
                return MARKUP(tmp);
            }

            // we will make a temporary fragment to hold the result
            let frag = doc.createDocumentFragment();
            for (let i = 0; i < spec.length; i++) MARKUP({
                parent: frag, pseudo: parent, spec: spec[i],
                doc: doc, args: args });
            if (frag.childNodes.length <= 0) return node;
            
            return ADJACENT[adj](frag, node);
        }
        else if (typeof spec === 'function') {
            let tmp = { spec: spec.apply(this, args), doc: doc, args: args };
            tmp[adj] = node;
            return MARKUP(tmp);
        }
        else if (spec instanceof Node) {
            // do this here because all nodes are objects
            return ADJACENT[adj](node.cloneNode(true), node);
        }
        // XXX we need a better test than this
        else if (typeof spec === 'object') {
            let keys = Object.keys(spec);
            if (keys.length === 0) return ADJACENT[adj](
                doc.createTextNode(spec.toString()), node);

            let name = null;
            let children = [];
            let ns = gatherNS(pseudo);
            let attrs = {};

            // get all the stuff out of the spec
            keys.forEach(function (k) {
                if (k.charAt(0) === '#') {
                    // blow up if name is already set
                    if (name !== null)
                        throw 'Ambiguous designators ' + name + ' and ' + k;

                    // think of the children
                    let ctmp = spec[k];
                    if (!(ctmp instanceof Array)) ctmp = [ctmp];
                    ctmp = ctmp.slice(); // copy the array

                    // name is first child
                    if (isTag(k)) name = ctmp.shift().toString();
                    else if (isReserved(k)) name = k; // noop
                    else name = k.substring(1); // ordinary element

                    // assign children
                    children = ctmp;
                }
                else {
                    let m = QNAME_RE.exec(k);
                    if (!m) return; // note we are in a nested function
                    // if this is an ns declaration we'll flatten it now
                    if (m[1] === 'xmlns' || (!m[1] && m[2] === 'xmlns'))
                        ns[m[1] ? m[2] : ''] = flatten(spec[k], args).trim();
                    // at any rate we add to the attributes
                    attrs[k] = spec[k];
                }
            });

            // comment
            if (name === '#comment') return ADJACENT[adj](
                doc.createComment(flatten(children, args)), node);
            // cdata
            else if (name === '#cdata') return ADJACENT[adj](
                doc.createCDATASection(flatten(children, args)), node);
            // processing instruction
            else if (name === '#pi' || name === '#processing-instruction') {
                let target = children.shift();
                if (!target) throw 'Processing instrucitons need a target';
                let data = (flatten(attrs, args, '=')
                            + ' ' + flatten(children, args)).trim();

                let pi = doc.createProcessingInstruction(target, data);
                return ADJACENT[adj](pi, node);
            }
            // dtd (lol i guess there's no dtd stuff in js dom?)
            else if (name === '#doctype' || name === '#dtd')
                throw 'DTDs are not implemented';
            // finally element
            else {
                let elem = ELEMENT(name, doc, ns, attrs, args);
                node = ADJACENT[adj](elem, node);

                // head off some unnecessary recursion
                if (children.length === 0) return node;
                return MARKUP(
                    { spec: children, parent: elem, doc: doc, args: args });
            }
        }
        else {
            // treat the spec like a string
            return ADJACENT[adj](doc.createTextNode(spec.toString()), node);
        }
    };

    return MARKUP;
})();
