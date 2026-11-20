"""Translation unit extraction and application for index.html.

A "unit" is the inner HTML of the outermost element whose descendants are all inline
(so a sentence keeps its <strong>/<br>/<a> markup together), plus stray text nodes in
mixed-content blocks, plus translatable attributes. Units are keyed by whitespace-collapsed
source text. Output pages are produced by splicing translations into the original source,
so markup, classes, scripts and layout are never re-serialized.
"""
import re
from html.parser import HTMLParser

INLINE = {'a', 'b', 'strong', 'em', 'i', 'u', 'br', 'span', 'small', 'sup', 'sub', 'abbr', 'mark', 's', 'wbr', 'code'}
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
SKIP = {'script', 'style', 'svg', 'noscript', 'template'}
ATTRS = ('alt', 'title', 'aria-label', 'placeholder', 'data-title')
LETTERS = re.compile(r'[A-Za-z]{2,}')


def norm(text):
    return re.sub(r'\s+', ' ', text).strip()


class Node:
    __slots__ = ('tag', 'attrs', 's0', 's1', 'e0', 'e1', 'children', 'texts', 'parent')

    def __init__(self, tag, attrs, s0, s1, parent):
        self.tag, self.attrs, self.s0, self.s1, self.parent = tag, attrs, s0, s1, parent
        self.e0 = self.e1 = None
        self.children, self.texts = [], []


class TreeBuilder(HTMLParser):
    def __init__(self, src):
        super().__init__(convert_charrefs=False)
        self.src = src
        self.line_offsets = [0]
        for m in re.finditer('\n', src):
            self.line_offsets.append(m.end())
        self.root = Node('#root', [], 0, 0, None)
        self.stack = [self.root]

    def off(self):
        line, col = self.getpos()
        return self.line_offsets[line - 1] + col

    def handle_starttag(self, tag, attrs):
        start = self.off()
        end = start + len(self.get_starttag_text())
        node = Node(tag, attrs, start, end, self.stack[-1])
        self.stack[-1].children.append(node)
        if tag in VOID:
            node.e0 = node.e1 = end
        else:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        start = self.off()
        end = start + len(self.get_starttag_text())
        node = Node(tag, attrs, start, end, self.stack[-1])
        node.e0 = node.e1 = end
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag):
        start = self.off()
        end = self.src.index('>', start) + 1
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                for n in self.stack[i:]:
                    if n.e0 is None:
                        n.e0, n.e1 = start, end
                del self.stack[i:]
                return

    def _text(self, data):
        start = self.off()
        self.stack[-1].texts.append((start, start + len(data)))

    def handle_data(self, data):
        self._text(data)

    def handle_entityref(self, name):
        self._text('&%s;' % name)

    def handle_charref(self, name):
        self._text('&#%s;' % name)


def build(src):
    tb = TreeBuilder(src)
    tb.feed(src)
    tb.close()
    return tb.root


def all_inline(node):
    return all(c.tag in INLINE and all_inline(c) for c in node.children)


def has_letters(src, node):
    inner = src[node.s1:node.e0] if node.e0 is not None else ''
    return bool(LETTERS.search(re.sub(r'<[^>]+>|&[a-z#0-9]+;', ' ', inner)))


def collect(src):
    """Return list of (start, end, key, kind) spans to translate, in document order."""
    root = build(src)
    spans = []

    def walk(node, skipping=False):
        skipping = skipping or node.tag in SKIP
        if node.tag != '#root' and not skipping:
            # attributes
            for name, value in node.attrs:
                if name in ATTRS and value and LETTERS.search(value):
                    tag_src = src[node.s0:node.s1]
                    m = re.search(r'\s%s\s*=\s*("([^"]*)"|\'([^\']*)\')' % re.escape(name), tag_src)
                    if m:
                        g = 2 if m.group(2) is not None else 3
                        spans.append((node.s0 + m.start(g), node.s0 + m.end(g), norm(m.group(g)), 'attr'))
                if node.tag == 'meta' and name == 'content':
                    attrs = dict(node.attrs)
                    if attrs.get('name') in ('description',) or attrs.get('property') in ('og:title', 'og:description'):
                        tag_src = src[node.s0:node.s1]
                        m = re.search(r'\scontent\s*=\s*"([^"]*)"', tag_src)
                        if m and LETTERS.search(m.group(1)):
                            spans.append((node.s0 + m.start(1), node.s0 + m.end(1), norm(m.group(1)), 'attr'))
        if skipping or dict(node.attrs).get('translate') == 'no':
            return
        direct_text = any(LETTERS.search(re.sub(r'&[a-z#0-9]+;', ' ', src[a:b])) for a, b in node.texts)
        if direct_text and node.tag not in ('#root', 'html', 'head', 'body', 'title') and node.e0 is not None and node.tag not in VOID \
                and all_inline(node) and has_letters(src, node):
            inner = src[node.s1:node.e0]
            lead = len(inner) - len(inner.lstrip())
            trail = len(inner) - len(inner.rstrip())
            spans.append((node.s1 + lead, node.e0 - trail, norm(inner), 'html'))
            # attributes of inline descendants still need translating
            for c in node.children:
                walk_attrs_only(c)
            return
        if node.tag == 'title' and node.e0 is not None:
            inner = src[node.s1:node.e0]
            spans.append((node.s1, node.e0, norm(inner), 'html'))
            return
        for (a, b) in node.texts:
            chunk = src[a:b]
            if LETTERS.search(re.sub(r'&[a-z#0-9]+;', ' ', chunk)):
                lead = len(chunk) - len(chunk.lstrip())
                trail = len(chunk) - len(chunk.rstrip())
                spans.append((a + lead, b - trail, norm(chunk), 'text'))
        for c in node.children:
            walk(c)

    def walk_attrs_only(node):
        for name, value in node.attrs:
            if name in ATTRS and value and LETTERS.search(value):
                tag_src = src[node.s0:node.s1]
                m = re.search(r'\s%s\s*=\s*("([^"]*)"|\'([^\']*)\')' % re.escape(name), tag_src)
                if m:
                    g = 2 if m.group(2) is not None else 3
                    spans.append((node.s0 + m.start(g), node.s0 + m.end(g), norm(m.group(g)), 'attr'))
        for c in node.children:
            walk_attrs_only(c)

    walk(root)
    spans.sort()
    # drop overlaps (attribute spans live inside start tags, never inside text spans' replaced range
    # except for inline descendants, which the html unit translation carries itself)
    result, last_end = [], -1
    html_ranges = [(a, b) for a, b, _, k in spans if k == 'html']
    for span in spans:
        a, b, key, kind = span
        if kind == 'attr' and any(ha <= a and b <= hb for ha, hb in html_ranges):
            continue  # inline child attribute inside an html unit: carried by the unit translation
        if a < last_end:
            continue
        result.append(span)
        last_end = b
    return result


def apply(src, catalog, lang_code):
    spans = collect(src)
    out, pos, missing = [], 0, []
    for a, b, key, kind in spans:
        out.append(src[pos:a])
        value = catalog.get(key)
        if value is None:
            missing.append(key)
            out.append(src[a:b])
        else:
            if kind == 'attr':
                value = value.replace('"', '&quot;')
            out.append(value)
        pos = b
    out.append(src[pos:])
    return ''.join(out), missing
