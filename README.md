# markup-mixup: A Sensible, Terse HTML/XML Markup Generator

```html
<script type="text/javascript" src="markup-mixup.js"></script>
<script type="text/javascript">
  // put something in the body
  let lol = MARKUP({ parent: document.body, spec: 'lol' });

  // lol is, unsurprisingly, the text node that says 'lol'
  let hurr = MARKUP({ after: lol, spec: { '#strong': 'smelling' } });

  // now we can put something in between these two; note `hurr`
  // is actually the text node 'smelling', so we need its parent
  let durr = MARKUP({ before: hurr.parentNode,
    spec: { '#a': ['duhh ', { '#em': 'durr' }], href: '/derp' } });

  // aaand finally we can cover up our mistakes
  MARKUP({ replace: lol, spec: { '#h1': 'OBTRUSIVE MESSAGE' } });
</script>
```

## Yet another markup generator?

Many years ago, [I](https://doriantaylor.com/) wrote a Perl module
called
[Role::Markup::XML](https://metacpan.org/pod/Role::Markup::XML). I did
this because I had a lot of XML to generate, and was dissatisfied with
what was currently on offer. Then I wrote [a version for
Ruby](https://www.rubydoc.info/gems/xml-mixup/). Now I have a lot of
XML to generate using JavaScript. As with the others, here are the key
behaviours:

### Write markup like you're writing code

You sketch out the markup using ordinary `Object`s and `Array`s, which
you can subsequently address and manipulate with ordinary subscript
operators. Heck, if it had the correct structure, you could even slurp
in a JSON file. When you're ready, you can "bake" the markup with a
single `MARKUP` function.

> Also: everything that isn't a plain `Object` or `Array` gets
> flattened out into a sensible string, including complex objects
> found in attribute values.

### Perform surgery on existing documents

Mix in and reuse existing DOM subtrees; they will automatically be
cloned for you. Choose from any of four attachment modes:

* Append to the end of a `parent` node,
* Insert immediately `before` a sibling node,
* Append immediately `after` a sibling node,
* `replace` a target node.

### Generate markup incrementally

Terse markup generators often use nested functions and tend to very
hard to segment and compartmentalize. In addition to being agnostic as
to whether it receives DOM objects or plain ones, the `MARKUP`
function has been designed to return the last (in document order) node
it generates, to make it easier to break up operations.

If your markup only varies parametrically, you can put a callback
function anywhere a node or attribute would go. This function will
receive `args` from the topmost invocation of `MARKUP`.

## The rest of the document

**TODO** lol

If you want to get a sense of what this thing does, go look at [the
Ruby version](https://github.com/doriantaylor/rb-xml-mixup).

## Copyright & License

Copyright 2021 [Dorian Taylor](https://doriantaylor.com/)

This software is provided under
the [Apache License, 2.0](https://www.apache.org/licenses/LICENSE-2.0).
