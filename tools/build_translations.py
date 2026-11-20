"""Build index-es.html, index-zh.html, index-tl.html, index-vi.html from index.html.

English index.html is the only page to edit by hand. After changing it:
  1. python3 tools/build_translations.py --check   (lists English text with no translation)
  2. add the new strings to tools/i18n/<lang>.json (keys must match the English exactly)
  3. python3 tools/i18n_validate.py <lang>
  4. python3 tools/build_translations.py

The build refuses to write a page while any translation is missing.
"""
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))
import i18n_units as units  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LANGS = ['es', 'zh', 'tl', 'vi']


def localize_chrome(html, lang):
    html, n = re.subn(r'<html\s+lang="en"', f'<html lang="{lang}"', html, count=1)
    assert n == 1, 'index.html must start with <html lang="en">'
    html = html.replace(
        'class="current-lang-code" translate="no">EN</span>',
        f'class="current-lang-code" translate="no">{lang.upper()}</span>',
    )
    html = html.replace('class="lang-option active" data-lang="en"', 'class="lang-option" data-lang="en"')
    html = html.replace(f'class="lang-option" data-lang="{lang}"', f'class="lang-option active" data-lang="{lang}"')
    return html


def main():
    check_only = '--check' in sys.argv
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    failed = False
    for lang in LANGS:
        catalog = json.load(open(os.path.join(ROOT, 'tools', 'i18n', f'{lang}.json'), encoding='utf-8'))
        translated, missing = units.apply(src, catalog, lang)
        missing = list(dict.fromkeys(missing))
        if missing:
            failed = True
            print(f'{lang}: {len(missing)} untranslated strings')
            for m in missing:
                print('   ', m[:120])
            continue
        if check_only:
            print(f'{lang}: complete')
            continue
        out = os.path.join(ROOT, f'index-{lang}.html')
        with open(out, 'w', encoding='utf-8', newline='\n') as f:
            f.write(localize_chrome(translated, lang))
        print(f'{lang}: wrote {os.path.basename(out)}')
    if failed:
        sys.exit(1)


if __name__ == '__main__':
    main()
