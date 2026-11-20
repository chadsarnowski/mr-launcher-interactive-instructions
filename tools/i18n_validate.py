"""Validate a translation catalog against index.html.

Usage: python3 tools/i18n_validate.py es
Checks: every unit present; HTML tags (with attributes) identical and in order;
digits preserved; phone numbers and URLs untouched; no leftover English sentences.
"""
import json, re, sys, os
sys.path.insert(0, os.path.dirname(__file__))
import i18n_units as u

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
lang = sys.argv[1]
src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
cat = json.load(open(os.path.join(ROOT, 'tools', 'i18n', f'{lang}.json'), encoding='utf-8'))
spans = u.collect(src)
keys = list(dict.fromkeys(k for _, _, k, _ in spans))
kinds = {k: kind for _, _, k, kind in spans}

TAG = re.compile(r'<[^>]+>')
DIGITS = re.compile(r'\d+')
EN_WORDS = re.compile(r"\b[A-Za-z]{4,}\b")
# Words allowed to remain in translations (brands, units, codes, proper nouns)
ALLOW = set(w.lower() for w in '''
Launcher Lifter Kayak Kandy Kane Muscle Docks Fabrication American AMERICANMUSCLEDOCKS americanmuscledocks blogs instructions https http html
Allen Phillips Crescent youtube amdocks Docky Dockly Captain Sch HDG AWG Volt Volts PDF PWC Jet Ski Mr noopener blank target href
class span strong wbr item diagram figure page tel www
bolt bolts stainless steel thread threads grease carriage stove hex
bracket brackets receiver receivers stabilizer stabilizers roller rollers rubber
pipe pipes tube tubes support supports platform platforms plataporma
floating float dock decking deck board section sections sleeper frame
drill drilled drilling wrench cordless nut nuts washer washers plate
residential launch grab callout mascot hardware website video videos
aluminum mounting flange inch inches ready
nbsp ldquo rdquo rsquo ndash mdash frac amp quot wbr
screen drawing drawings full tap click open image images
'''.split())

# Strings that are correct when identical to English: proper nouns and URLs
IDENTICAL_OK = {
    'American Muscle Docks &amp; Fabrication',
    'americanmuscledocks.com/<wbr>blogs/instructions',
    'MR. LAUNCHER 2.0',
}

errors = []
for k in keys:
    if k not in cat:
        errors.append(f'MISSING: {k[:90]}')
        continue
    v = cat[k]
    if not isinstance(v, str) or not v.strip():
        errors.append(f'EMPTY: {k[:90]}')
        continue
    if TAG.findall(k) != TAG.findall(v):
        errors.append(f'TAGS DIFFER: {k[:90]}\n   -> {v[:90]}')
    if sorted(DIGITS.findall(k)) != sorted(DIGITS.findall(v)):
        errors.append(f'DIGITS DIFFER: {k[:90]}\n   -> {v[:90]}')
    if kinds[k] == 'attr' and ('<' in v or '"' in v):
        errors.append(f'ATTR HAS MARKUP OR QUOTE: {v[:90]}')
    plain_k = TAG.sub(' ', k)
    plain_v = TAG.sub(' ', v)
    en_left = [w for w in EN_WORDS.findall(plain_v) if w.lower() not in ALLOW and re.search(r'\b%s\b' % re.escape(w), plain_k)]
    if v == k and k not in IDENTICAL_OK and len(EN_WORDS.findall(plain_k)) >= 3 and lang != 'en':
        errors.append(f'UNTRANSLATED: {k[:90]}')
    elif len(en_left) >= 4:
        errors.append(f'MOSTLY ENGLISH ({len(en_left)} words kept): {v[:90]}')

extra = set(cat) - set(keys)
print(f'{lang}: {len(keys)} units, {len(errors)} issues, {len(extra)} unused entries')
for e in errors:
    print(' ', e)
sys.exit(1 if errors else 0)
