#!/usr/bin/env python3
"""Scrub and retag a Canva export of the CV, prove the result, then publish it.

    npm run publish:cv -- path/to/canva-export.pdf

Needs pikepdf (`apt install python3-pikepdf`) and poppler-utils; no Node
library rewrites a structure tree without dropping tags. Not run in CI.

Every export repeats Canva's defects, so every export is fixed:
- Eleven invisible Figures become artifacts (`/Alt ()` fails veraPDF).
- The photo becomes an artifact: the name H1 beside it says who it shows.
- H1s join into one, H2 stays, H3 to H6 become P: only H1/H2 are stable.
- Identifying metadata and the German language tag are removed.
- An export that shows a phone number is refused before anything is written.

- Artifact-wrapped forms with tagged text are drawn in the page stream, so
  nothing is tagged inside an artifact and Firefox's viewer reads the structure.

Unmeasured shapes stop the run; public/ is written only after verification,
render comparison and check:pdf.
"""

import json
import math
import os
import re
import shutil
import struct
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
from pathlib import Path

try:
    import pikepdf
except ImportError:
    sys.exit('publish:cv needs pikepdf: apt install python3-pikepdf')

REPO = Path(__file__).resolve().parent.parent
PUBLISHED = REPO / 'public' / 'sinduri-guntupalli-cv.pdf'
# check:pdf only validates files inside the repository; tmp/ is gitignored.
WORK_DIR = REPO / 'tmp'
WORK_DIR_MODE = 0o755

LANGUAGE = 'en'
SECTIONS = (
    'CONTACT',
    'AWARDS',
    'EDUCATION',
    'ADDITIONAL INFORMATION',
    'SUMMARY',
    'WORK EXPERIENCE',
)

INFO_REMOVED = ('/Author', '/Creator', '/Producer', '/Keywords')
XMP_REMOVED = ('dc:creator', 'xmp:CreatorTool', 'pdf:Producer', 'pdf:Keywords')

HEADINGS = ('/H1', '/H2', '/H3', '/H4', '/H5', '/H6')
FLATTENED = ('/H3', '/H4', '/H5', '/H6')
# Every type in the measured exports; anything else needs a person.
KNOWN_TYPES = frozenset(
    ('/Document', '/Part', '/Figure', '/P', '/Span', '/Link', '/L', '/LI',
     '/Lbl', '/LBody') + HEADINGS
)

# The published CV shows email and city only; a phone number must never ship.
PHONE_CANDIDATE = re.compile(r'\+?\d[\d ()./-]{5,}\d')
YEAR_RANGE = re.compile(r'(19|20)\d\d\s*[-\u2013]\s*(19|20)\d\d')
PHONE_MIN_DIGITS = 9
PHONE_MIN_DIGITS_INTERNATIONAL = 7
RENDER_DPI = '100'
# Inlining the form drops its transparency group, which moves glyph-edge
# anti-aliasing; these bounds allow that shift and no more.
RENDER_MAX_CHANGED_SHARE = 0.002
RENDER_MAX_CHANNEL_DELTA = 96
TEXT_SHOW = ('Tj', 'TJ', "'", '"')
FILLS = ('f', 'F', 'f*')
STROKES = ('S', 's')
FILLS_AND_STROKES = ('B', 'B*', 'b', 'b*')
OPAQUE = 1.0
NO_MASK = pikepdf.Name('/None')
SIZE_DECIMALS = 2

NS = {
    'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    'dc': 'http://purl.org/dc/elements/1.1/',
    'pdf': 'http://ns.adobe.com/pdf/1.3/',
    'xmp': 'http://ns.adobe.com/xap/1.0/',
}
XML_LANG = '{http://www.w3.org/XML/1998/namespace}lang'
XPACKET_BEGIN = '<?xpacket begin="\ufeff" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
XPACKET_END = '\n<?xpacket end="w"?>'


def reject(*reasons):
    lines = '\n'.join(f'  - {reason}' for reason in reasons)
    sys.exit(f'publish:cv rejected the export. public/ is untouched.\n{lines}')


def kids(element):
    k = element.get('/K')
    if k is None:
        return []
    return list(k) if isinstance(k, pikepdf.Array) else [k]


def is_struct(node):
    return isinstance(node, pikepdf.Dictionary) and '/S' in node


def walk(element):
    """Structure elements under `element`, depth first, in reading order."""
    for kid in kids(element):
        if is_struct(kid):
            yield kid
            yield from walk(kid)


def mcid_refs(element, page=None):
    """(page objgen, MCID) for every marked-content reference under `element`."""
    page = element.get('/Pg', page)
    for kid in kids(element):
        if isinstance(kid, pikepdf.Dictionary) and kid.get('/Type') == '/MCR':
            if '/Stm' in kid:
                reject('A marked-content reference names its own stream (/Stm).')
            yield kid.get('/Pg', page).objgen, int(kid.MCID)
        elif is_struct(kid):
            yield from mcid_refs(kid, page)
        elif not isinstance(kid, pikepdf.Dictionary):
            yield page.objgen, int(kid)


def title(element):
    return ' '.join(str(element.get('/T', '')).split())


def multiply(a, b):
    return [
        a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3],
        a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
        a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5],
    ]


def truetype_glyphs(font_file):
    """Glyph id to character from a TrueType cmap (formats 4 and 12).

    Canva embeds no ToUnicode map, so this is how the drawn text is read.
    """
    data = font_file.read_bytes()
    count = struct.unpack('>H', data[4:6])[0]
    tables = {data[12 + 16 * i:16 + 16 * i]: struct.unpack('>I', data[20 + 16 * i:24 + 16 * i])[0]
              for i in range(count)}
    if b'cmap' not in tables:
        reject('An embedded font has no cmap, so its drawn text cannot be read.')
    base = tables[b'cmap']
    glyphs = {}
    for i in range(struct.unpack('>H', data[base + 2:base + 4])[0]):
        offset = struct.unpack('>I', data[base + 8 + 8 * i:base + 12 + 8 * i])[0]
        sub = base + offset
        fmt = struct.unpack('>H', data[sub:sub + 2])[0]
        if fmt == 4:
            half = struct.unpack('>H', data[sub + 6:sub + 8])[0] // 2
            ends = struct.unpack(f'>{half}H', data[sub + 14:sub + 14 + 2 * half])
            at = sub + 16 + 2 * half
            starts = struct.unpack(f'>{half}H', data[at:at + 2 * half])
            deltas = struct.unpack(f'>{half}h', data[at + 2 * half:at + 4 * half])
            ranges_at = at + 4 * half
            ranges = struct.unpack(f'>{half}H', data[ranges_at:ranges_at + 2 * half])
            for seg, (start, end, delta, rng) in enumerate(zip(starts, ends, deltas, ranges)):
                for code in range(start, min(end, 0xFFFE) + 1):
                    if rng:
                        at_glyph = ranges_at + 2 * seg + rng + 2 * (code - start)
                        gid = struct.unpack('>H', data[at_glyph:at_glyph + 2])[0]
                        gid = (gid + delta) & 0xFFFF if gid else 0
                    else:
                        gid = (code + delta) & 0xFFFF
                    if gid:
                        glyphs.setdefault(gid, chr(code))
        elif fmt == 12:
            for g in range(struct.unpack('>I', data[sub + 12:sub + 16])[0]):
                first, last, gid = struct.unpack('>III', data[sub + 16 + 12 * g:sub + 28 + 12 * g])
                for code in range(first, last + 1):
                    glyphs.setdefault(gid + code - first, chr(code))
    return glyphs


GLYPHS = {}


def drawn_chars(font, raw):
    """The characters a Type0 Identity-H string draws, via the embedded font."""
    if font.get('/Subtype') != '/Type0' or font.get('/Encoding') != '/Identity-H':
        reject(f'Font {font.get("/BaseFont")} is not Type0 Identity-H, which this script reads.')
    if font.objgen not in GLYPHS:
        GLYPHS[font.objgen] = truetype_glyphs(font.DescendantFonts[0].FontDescriptor.FontFile2)
    glyphs = GLYPHS[font.objgen]
    return ''.join(glyphs.get(int.from_bytes(raw[i:i + 2], 'big'), '\ufffd')
                   for i in range(0, len(raw), 2))


def marked_properties(operands, resources):
    props = operands[1]
    if isinstance(props, pikepdf.Name):
        props = resources.Properties[props]
    return props


def scan_page(page):
    """What each MCID on a page draws, and which stream holds its BDC.

    A form without /StructParents counts its MCIDs in the page's space, as
    Firefox resolves them; veraPDF does not.
    """
    found = {}

    def record(mcid):
        return found.setdefault(
            mcid, {'stream': None, 'images': [], 'visible': False, 'text': None,
                   'chars': '', 'in_artifact': False}
        )

    def scan(source, resources, owner, ctm, owner_artifact=False):
        state = {'ctm': ctm, 'fill': OPAQUE, 'stroke': OPAQUE}
        saved, marks, artifacts = [], [], []
        font, size, text_matrix = None, 0.0, [1, 0, 0, 1, 0, 0]
        for operands, operator in pikepdf.parse_content_stream(source):
            op = str(operator)
            current = next((m for m in reversed(marks) if m is not None), owner)
            in_artifact = owner_artifact or any(artifacts)
            if op == 'q':
                saved.append(dict(state))
            elif op == 'Q':
                state = saved.pop()
            elif op == 'cm':
                state['ctm'] = multiply([float(x) for x in operands], state['ctm'])
            elif op == 'gs':
                ext = resources.ExtGState[operands[0]]
                state['fill'] = float(ext.get('/ca', state['fill']))
                state['stroke'] = float(ext.get('/CA', state['stroke']))
                if ext.get('/SMask', NO_MASK) != NO_MASK:
                    state['fill'] = state['stroke'] = OPAQUE
            elif op in ('BDC', 'BMC'):
                mcid = None
                if op == 'BDC':
                    props = marked_properties(operands, resources)
                    if '/MCID' in props:
                        mcid = int(props.MCID)
                        record(mcid)['stream'] = source
                        record(mcid)['in_artifact'] |= in_artifact
                marks.append(mcid)
                artifacts.append(operands[0] == pikepdf.Name.Artifact)
            elif op == 'EMC':
                marks.pop()
                artifacts.pop()
            elif op == 'Tf':
                font, size = resources.Font[operands[0]], float(operands[1])
            elif op == 'Tm':
                text_matrix = [float(x) for x in operands]
            elif op in TEXT_SHOW and current is not None:
                entry = record(current)
                strings = operands[0] if op == 'TJ' else [operands[-1]]
                entry['chars'] += ''.join(drawn_chars(font, bytes(part)) for part in strings
                                          if isinstance(part, pikepdf.String))
                if entry['text'] is None:
                    m = multiply(text_matrix, state['ctm'])
                    scale = math.hypot(m[2], m[3])
                    entry['text'] = (str(font.get('/BaseFont')), round(size * scale, SIZE_DECIMALS))
            elif op == 'Do':
                xobject = resources.XObject[operands[0]]
                if xobject.Subtype == '/Image':
                    if current is not None:
                        record(current)['images'].append(xobject)
                elif xobject.Subtype == '/Form':
                    if '/StructParents' in xobject:
                        reject('A form XObject numbers its own marked content (/StructParents).')
                    matrix = [float(x) for x in xobject.get('/Matrix', [1, 0, 0, 1, 0, 0])]
                    scan(xobject, xobject.get('/Resources', resources), current,
                         multiply(matrix, state['ctm']), in_artifact)
            elif op == 'INLINE IMAGE' and current is not None:
                record(current)['images'].append(None)
            elif current is not None and (
                (op in FILLS and state['fill'] > 0)
                or (op in STROKES and state['stroke'] > 0)
                or (op in FILLS_AND_STROKES and max(state['fill'], state['stroke']) > 0)
                or op == 'sh'
            ):
                record(current)['visible'] = True

    scan(page.obj, page.Resources, None, [1, 0, 0, 1, 0, 0])
    return found


def scan_document(pdf):
    return {
        (page.obj.objgen, mcid): info
        for page in pdf.pages
        for mcid, info in scan_page(page).items()
    }


def drawn(element, marks):
    refs = list(mcid_refs(element))
    missing = [ref for ref in refs if ref not in marks]
    if missing:
        reject(f'{element.S} references marked content that is not on its page: {missing}.')
    return [marks[ref] for ref in refs]


def classify_figure(figure, marks):
    parts = drawn(figure, marks)
    images = [image for part in parts for image in part['images']]
    if images:
        return 'photo', images
    if any(part['visible'] or part['text'] for part in parts):
        reject('A Figure draws a visible shape or text and no image. Canva has '
               'tagged something meaningful as a graphic; it needs a person.')
    return 'decoration', []


def first_text(element, marks):
    styles = [part['text'] for part in drawn(element, marks) if part['text']]
    if not styles:
        reject(f'{element.S} "{title(element)}" draws no text.')
    return styles[0]


def detach(element):
    parent = element.P
    parent.K = pikepdf.Array([k for k in kids(parent) if not (is_struct(k) and k.objgen == element.objgen)])


def parent_tree(pdf):
    return pikepdf.NumberTree(pdf.Root.StructTreeRoot.ParentTree)


def page_entries(pdf, tree, page_objgen):
    page = next(p for p in pdf.pages if p.obj.objgen == page_objgen)
    return tree[int(page.obj.StructParents)]


def check_preconditions(pdf):
    root = pdf.Root
    if '/StructTreeRoot' not in root or not root.get('/MarkInfo', {}).get('/Marked', False):
        reject('The export is not a tagged PDF. Export it from Canva with tags on.')
    if len(root.StructTreeRoot.get('/RoleMap', {})) > 0:
        reject('The structure tree has a RoleMap, so tag names may not mean what they say.')
    if '/Title' not in pdf.docinfo:
        reject('The export has no /Title, which a reader announces and PDF/UA requires.')
    unknown = sorted({str(e.S) for e in walk(root.StructTreeRoot) if str(e.S) not in KNOWN_TYPES})
    if unknown:
        reject(f'Structure types this script has never seen: {", ".join(unknown)}.')


def artifact_figures(pdf, figures, marks):
    """Untag each Figure: drop it from the tree, and mark its content /Artifact."""
    tree = parent_tree(pdf)
    by_stream = {}
    for figure in figures:
        for ref in mcid_refs(figure):
            stream = marks[ref]['stream']
            by_stream.setdefault(stream.objgen, (stream, set()))[1].add(ref[1])
            page_entries(pdf, tree, ref[0])[ref[1]] = None
        detach(figure)

    for stream, wanted in by_stream.values():
        page = next((p for p in pdf.pages if p.obj.objgen == stream.objgen), None)
        if page is None and '/Resources' not in stream:
            reject('A Figure is marked in a form without its own /Resources, which is untested.')
        resources = page.Resources if page else stream.Resources
        rewritten = [
            ([pikepdf.Name.Artifact], pikepdf.Operator('BMC'))
            if str(op) == 'BDC'
            and int(marked_properties(operands, resources).get('/MCID', -1)) in wanted
            else (operands, op)
            for operands, op in pikepdf.parse_content_stream(page or stream)
        ]
        content = pikepdf.unparse_content_stream(rewritten)
        if page:
            page.obj.Contents = pdf.make_stream(content)
        else:
            stream.write(content)


def retag_headings(pdf):
    headings = [e for e in walk(pdf.Root.StructTreeRoot) if e.S in HEADINGS]
    h1s = [h for h in headings if h.S == '/H1']
    if not h1s:
        reject('No H1. The name should be the first heading.')
    if any(h.S != '/H1' for h in headings[:len(h1s)]):
        reject('An H1 comes after another heading, so it is not the name at the top.')

    first, rest = h1s[0], h1s[1:]
    siblings = [k.objgen if is_struct(k) else None for k in kids(first.P)]
    at = siblings.index(first.objgen)
    if siblings[at:at + len(h1s)] != [h.objgen for h in h1s]:
        reject('The H1s are not adjacent siblings, so joining them would reorder content.')

    if rest:
        tree = parent_tree(pdf)
        joined = ' '.join(title(h) for h in h1s)
        for h in rest:
            for ref in mcid_refs(h):
                page_entries(pdf, tree, ref[0])[ref[1]] = first
            for kid in kids(h):
                if is_struct(kid):
                    kid.P = first
            detach(h)
        first.K = pikepdf.Array([k for h in h1s for k in kids(h)])
        first.T = pikepdf.String(joined)
        # /E replaces the content when spoken: it must cover the whole heading.
        if '/E' in first:
            first.E = pikepdf.String(joined)

    for h in headings:
        if h.S in FLATTENED:
            h.S = pikepdf.Name.P


def holds_tagged_text(form):
    resources = form.get('/Resources', pikepdf.Dictionary())
    marks = []
    for operands, operator in pikepdf.parse_content_stream(form):
        op = str(operator)
        if op == 'BDC':
            marks.append('/MCID' in marked_properties(operands, resources))
        elif op == 'BMC':
            marks.append(False)
        elif op == 'EMC':
            marks.pop()
        elif op in TEXT_SHOW and any(marks):
            return True
        elif op == 'Do':
            nested = resources.XObject[operands[0]]
            if nested.Subtype == '/Form' and holds_tagged_text(nested):
                return True
    return False


def inline_forms(pdf):
    """Draw each Artifact-wrapped form with tagged text in its page's stream.

    Canva nests tagged forms in /Artifact wrappers (PDF/UA-1 7.1). Inlined, the
    MCIDs sit in the page stream the structure tree numbers, and Firefox's
    viewer keeps it. The photo's form holds no text and stays wrapped, since
    inlining it drops its transparency group and moves the circle's edge.
    """
    for page in pdf.pages:
        while inline_page_forms(pdf, page):
            pass


def inline_page_forms(pdf, page):
    resources = page.Resources
    ops = list(pikepdf.parse_content_stream(page.obj))
    out, inlined = [], set()
    i = 0
    while i < len(ops):
        window = ops[i:i + 3]
        if (len(window) == 3 and str(window[0][1]) == 'BMC'
                and window[0][0][0] == pikepdf.Name.Artifact
                and str(window[1][1]) == 'Do' and str(window[2][1]) == 'EMC'):
            name = window[1][0][0]
            form = resources.XObject[name]
            if form.Subtype == '/Form' and holds_tagged_text(form):
                if '/StructParents' in form:
                    reject('A form XObject numbers its own marked content (/StructParents).')
                x0, y0, x1, y1 = (float(v) for v in form.BBox)
                out.append(([], pikepdf.Operator('q')))
                if '/Matrix' in form:
                    out.append((list(form.Matrix), pikepdf.Operator('cm')))
                out += [([x0, y0, x1 - x0, y1 - y0], pikepdf.Operator('re')),
                        ([], pikepdf.Operator('W')), ([], pikepdf.Operator('n'))]
                out += list(pikepdf.parse_content_stream(form))
                out.append(([], pikepdf.Operator('Q')))
                merge_resources(resources, form.get('/Resources', {}), name)
                inlined.add(name)
                i += 3
                continue
        out.append(ops[i])
        i += 1
    still_drawn = {operands[0] for operands, op in out if str(op) == 'Do'}
    for name in inlined - still_drawn:
        del resources.XObject[name]
    if inlined:
        page.obj.Contents = pdf.make_stream(pikepdf.unparse_content_stream(out))
    return bool(inlined)


def merge_resources(resources, extra, form_name):
    for category, entries in extra.items():
        if category == '/ProcSet':
            continue
        if category not in resources:
            resources[category] = pikepdf.Dictionary()
        target = resources[category]
        for name, value in entries.items():
            if name in target and target[name].objgen != value.objgen:
                reject(f'Inlining {form_name} would rename {category} {name}, which is untested.')
            target[name] = value


def tag(pdf):
    inline_forms(pdf)
    marks = scan_document(pdf)
    figures = [e for e in walk(pdf.Root.StructTreeRoot) if e.S == '/Figure']
    kinds = [(f, *classify_figure(f, marks)) for f in figures]
    photos = [f for f, kind, _ in kinds if kind == 'photo']
    if len(photos) != 1:
        reject(f'Expected one Figure with an image, the photo; found {len(photos)}.')
    artifact_figures(pdf, figures, marks)
    retag_headings(pdf)


def scrub_xmp(pdf):
    if '/Metadata' not in pdf.Root:
        return
    xml = pdf.Root.Metadata.read_bytes().decode('utf-8')
    start, end = xml.index('<rdf:RDF'), xml.index('</rdf:RDF>') + len('</rdf:RDF>')
    for prefix, uri in NS.items():
        ET.register_namespace(prefix, uri)
    ET.register_namespace('pdfuaid', 'http://www.aiim.org/pdfua/ns/id/')
    rdf = ET.fromstring(xml[start:end])
    removed = {f'{{{NS[p]}}}{n}' for p, n in (k.split(':') for k in XMP_REMOVED)}
    for description in rdf.iter(f'{{{NS["rdf"]}}}Description'):
        for name in removed & set(description.attrib):
            del description.attrib[name]
        for child in [c for c in description if c.tag in removed]:
            description.remove(child)
        language = f'{{{NS["dc"]}}}language'
        if language in description.attrib:
            description.attrib[language] = LANGUAGE
        for element in description.iter():
            if element.tag == f'{{{NS["rdf"]}}}li' and element.get(XML_LANG) not in (None, 'x-default'):
                element.set(XML_LANG, LANGUAGE)
    for alt in rdf.iter(f'{{{NS["rdf"]}}}Alt'):
        seen = set()
        for li in list(alt):
            if li.get(XML_LANG) in seen:
                alt.remove(li)
            seen.add(li.get(XML_LANG))
    body = ET.tostring(rdf, encoding='unicode')
    pdf.Root.Metadata = pdf.make_stream(
        (XPACKET_BEGIN + body + XPACKET_END).encode('utf-8'),
        Type=pikepdf.Name.Metadata, Subtype=pikepdf.Name.XML,
    )


def scrub(pdf):
    for key in INFO_REMOVED:
        if key in pdf.docinfo:
            del pdf.docinfo[key]
    pdf.Root.Lang = pikepdf.String(LANGUAGE)
    scrub_xmp(pdf)


def verify(output, source):
    """Re-derive every claim from the written file; returns what is wrong."""
    problems = []
    with pikepdf.open(output) as pdf:
        root = pdf.Root
        if not root.get('/MarkInfo', {}).get('/Marked', False) or '/StructTreeRoot' not in root:
            return ['The output is not a tagged PDF.']
        if str(root.get('/Lang', '')) != LANGUAGE:
            problems.append(f'/Lang is {root.get("/Lang")}, not {LANGUAGE}.')
        leaked = [k for k in INFO_REMOVED if k in pdf.docinfo]
        if leaked:
            problems.append(f'The info dictionary still has {", ".join(leaked)}.')
        if '/Title' not in pdf.docinfo:
            problems.append('The /Title is gone.')
        if '/Metadata' in root:
            xmp = root.Metadata.read_bytes().decode('utf-8')
            problems += [f'The XMP still has {k}.' for k in XMP_REMOVED if k in xmp]
            rdf = ET.fromstring(xmp[xmp.index('<rdf:RDF'):xmp.index('</rdf:RDF>') + len('</rdf:RDF>')])
            languages = {e.get(XML_LANG) for e in rdf.iter()} - {None, 'x-default', LANGUAGE}
            languages |= {d.get(f'{{{NS["dc"]}}}language') for d in rdf.iter(f'{{{NS["rdf"]}}}Description')} - {None, LANGUAGE}
            if languages:
                problems.append(f'The XMP declares other languages: {sorted(languages)}.')
        elements = list(walk(root.StructTreeRoot))
        other_langs = sorted({str(e.Lang) for e in elements if '/Lang' in e} - {LANGUAGE})
        if other_langs:
            problems.append(f'Structure elements declare other languages: {other_langs}.')

        marks = scan_document(pdf)
        page_streams = {page.obj.objgen for page in pdf.pages}
        text_in_forms = sorted(mcid for (_, mcid), info in marks.items()
                               if info['chars'] and info['stream'].objgen not in page_streams)
        if text_in_forms:
            problems.append(f'MCIDs {text_in_forms} draw text inside a form XObject.')
        # PDF/UA-1 7.1; veraPDF does not flag it.
        tagged_in_artifacts = sorted(mcid for (_, mcid), info in marks.items() if info['in_artifact'])
        if tagged_in_artifacts:
            problems.append(f'MCIDs {tagged_in_artifacts} are tagged inside an /Artifact.')
        headings = [e for e in elements if e.S in HEADINGS]
        levels = [str(h.S)[1:] for h in headings]
        if levels != ['H1'] + ['H2'] * len(SECTIONS):
            problems.append(f'Heading sequence is {levels}, not one H1 then {len(SECTIONS)} H2s.')
        else:
            sections = tuple(title(h) for h in headings[1:])
            if sections != SECTIONS:
                problems.append(f'Section titles are {sections}, expected {SECTIONS}. If '
                                'the CV really changed, read the new outline and update SECTIONS.')
            # Whitespace-blind: a title drawn on two lines has no space glyph between them.
            for heading in headings:
                shown = ''.join(''.join(part['chars'] for part in drawn(heading, marks)).split())
                if shown != ''.join(title(heading).split()):
                    problems.append(f'{heading.S} is labelled "{title(heading)}" but draws "{shown}".')
            h1_style = first_text(headings[0], marks)
            h2_styles = {first_text(h, marks) for h in headings[1:]}
            if len(h2_styles) != 1:
                problems.append(f'The H2s are not one style: {sorted(h2_styles)}.')
            elif h1_style[1] <= next(iter(h2_styles))[1]:
                problems.append(f'The H1 ({h1_style}) is not larger than the H2s ({h2_styles}).')

        figures = [e for e in elements if e.S == '/Figure']
        if figures:
            problems.append(f'{len(figures)} Figures are tagged; the photo and shapes are decoration.')

    raw = output.read_bytes()
    problems += [f'The file still contains {k}.' for k in (*INFO_REMOVED, *XMP_REMOVED)
                 if k.encode() in raw]
    problems += [f'The output shows a phone number ({number}); remove it in Canva.'
                 for number in phone_numbers(output)]
    problems += compare_rendering(source, output)
    return problems


def run(*command):
    result = subprocess.run(command, capture_output=True)
    if result.returncode != 0:
        reject(f'{command[0]} failed: {result.stderr.decode(errors="replace").strip()}')
    return result.stdout


def phone_numbers(pdf_path):
    found = []
    text = run('pdftotext', str(pdf_path), '-').decode('utf-8', errors='replace')
    for match in PHONE_CANDIDATE.finditer(text):
        candidate = match.group().strip()
        if YEAR_RANGE.fullmatch(candidate):
            continue
        digits = len(re.sub(r'\D', '', candidate))
        if digits >= PHONE_MIN_DIGITS or (
            candidate.startswith('+') and digits >= PHONE_MIN_DIGITS_INTERNATIONAL
        ):
            found.append(candidate)
    return found


def compare_rendering(source, output):
    problems = []
    if run('pdftotext', '-layout', str(source), '-') != run('pdftotext', '-layout', str(output), '-'):
        problems.append('The text extracted from the output differs from the export.')
    with tempfile.TemporaryDirectory() as pages:
        for name, pdf in (('source', source), ('output', output)):
            run('pdftoppm', '-r', RENDER_DPI, str(pdf), str(Path(pages) / name))
        rendered = sorted(Path(pages).iterdir())
        source_pages = [p for p in rendered if p.name.startswith('source')]
        output_pages = [p for p in rendered if p.name.startswith('output')]
        if len(source_pages) != len(output_pages):
            problems.append('The output has a different number of pages from the export.')
        for number, (a, b) in enumerate(zip(source_pages, output_pages), start=1):
            problems += render_drift(number, a.read_bytes(), b.read_bytes())
    return problems


def render_drift(number, source, output):
    """Differences between two binary PPM renders beyond anti-aliasing."""
    source_head, source_pixels = source.split(b'\n', 3)[1], source.split(b'\n', 3)[3]
    output_head, output_pixels = output.split(b'\n', 3)[1], output.split(b'\n', 3)[3]
    if source_head != output_head:
        return [f'Page {number} renders at a different size from the export.']
    width, height = map(int, source_head.split())
    changed, worst = 0, 0
    for i in range(0, len(source_pixels), 3):
        if source_pixels[i:i + 3] != output_pixels[i:i + 3]:
            changed += 1
            worst = max(worst, *(abs(source_pixels[i + k] - output_pixels[i + k]) for k in range(3)))
    share = changed / (width * height)
    if share > RENDER_MAX_CHANGED_SHARE or worst > RENDER_MAX_CHANNEL_DELTA:
        return [f'Page {number} renders differently from the export: {changed} pixels '
                f'({share:.3%}), channel delta up to {worst}.']
    return []


def validate(output):
    scripts = json.loads((REPO / 'package.json').read_text())['scripts']
    if 'check:pdf' not in scripts:
        reject('npm run check:pdf does not exist on this branch, so the output cannot be validated.')
    result = subprocess.run(
        ['npm', 'run', '--silent', 'check:pdf', '--', str(output.relative_to(REPO))],
        cwd=REPO,
    )
    if result.returncode != 0:
        reject('check:pdf did not pass the output (report above).')


def main(argv):
    if len(argv) != 2:
        sys.exit(__doc__)
    source = Path(argv[1]).resolve()
    if not source.is_file():
        sys.exit(f'publish:cv: {argv[1]} is not a file.')
    numbers = phone_numbers(source)
    if numbers:
        reject(f'The export shows a phone number ({", ".join(numbers)}). '
               'The published CV carries email and city only; remove it in Canva.')

    WORK_DIR.mkdir(exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='publish-cv-', dir=WORK_DIR))
    # mkdtemp makes it 0700, and veraPDF's container runs as another user.
    work.chmod(WORK_DIR_MODE)
    try:
        output = work / PUBLISHED.name
        try:
            pdf = pikepdf.open(source)
        except pikepdf.PdfError as error:
            reject(f'{source} is not a readable PDF: {error}')
        with pdf:
            check_preconditions(pdf)
            tag(pdf)
            scrub(pdf)
            # No object streams: tests/cv.spec.ts asserts on raw bytes.
            # Deterministic /ID: the same export gives the same file.
            pdf.save(output, object_stream_mode=pikepdf.ObjectStreamMode.disable,
                     deterministic_id=True)

        problems = verify(output, source)
        if problems:
            reject(*problems)
        validate(output)
        os.replace(output, PUBLISHED)
        print(f'Published {PUBLISHED.relative_to(REPO)}. Read it once in a PDF reader before committing.')
    finally:
        shutil.rmtree(work)


if __name__ == '__main__':
    main(sys.argv)
