#!/usr/bin/env python3
"""Canonicalize OCR'd angiography system names to (maker, model) pairs."""
import re, unicodedata
from rapidfuzz import fuzz

MAKER_BY_FAMILY = {
    'Azurion': 'フィリップス', 'Allura Xper': 'フィリップス', 'Integris': 'フィリップス',
    'INFX': 'キヤノン', 'Alphenix': 'キヤノン', 'Infinix Celeve': 'キヤノン',
    'Artis': 'シーメンス', 'ARTIS icono': 'シーメンス', 'ARTIS pheno': 'シーメンス',
    'Innova': 'GE', 'IGS': 'GE', 'Allia IGS': 'GE', 'Discovery': 'GE', 'Advantx': 'GE',
    'ACT FP': 'GE',
    'Trinias': '島津製作所', 'BRANSIST safire': '島津製作所', 'DIGITEX': '島津製作所',
    'Cvision': '島津製作所', 'CVS package': '島津製作所', 'MH': '島津製作所',
    'Integris Allura': 'フィリップス',
}

FAMILIES = [
    # (canonical family, fuzzy probes)
    ('Azurion', ['AZURION', 'AANION', 'AARION', 'AZURIN', 'AURION', 'AMRION', 'ANURION', 'AZUION']),
    ('Allura Xper', ['ALLURAXPER', 'ALLURA', 'ALURAXPER', 'AMURAXPER', 'ALLIRAXPER', 'XPER']),
    ('Integris Allura', ['INTEGRISALLURA', 'INTEGRISALURA']),
    ('Integris', ['INTEGRIS', 'INTEGRISCV', 'INTEGRISH']),
    ('INFX', ['INFX8000', 'NFX8000', 'INEX8000', 'INFX', 'NYC8000', 'INF8000', '8000V', '8000C']),
    ('Alphenix', ['ALPHENIX', 'ALPHEMX', 'AHEMX', 'ALPHENK', 'APHENIX', 'ALPBENIX']),
    ('Infinix Celeve', ['INFINIXCELEVE', 'CELEVE', 'INFINIX']),
    ('ARTIS icono', ['ARTISICONO', 'ICONO', 'ICONODSPIN']),
    ('ARTIS pheno', ['ARTISPHENO', 'PHENO']),
    ('Artis', ['ARTIS', 'ARTISZEE', 'ARTS', 'ARTISZEEGO', 'ARIS', 'ATIS']),
    ('Innova', ['INNOVA', 'TNNOVA', 'INOVA', 'LNNOVA']),
    ('Allia IGS', ['ALLIAIGS', 'ALLIA', 'ALIAIGS']),
    ('Discovery', ['DISCOVERY', 'DISCOVER']),
    ('Advantx', ['ADVANTX', 'ADVANTIX', 'ADVANIX']),
    ('ACT FP', ['ACTFP']),
    ('IGS', ['IGS', 'JGS', 'LGS', 'TGS', 'IOS5', 'ICS5', 'ICS6', 'ICS7', 'JCS']),
    ('Trinias', ['TRINIAS', 'TNNAS', 'TRMAS', 'TRINAS', 'TRIMAS', 'TRNIAS', 'TRINIA']),
    ('BRANSIST safire', ['BRANSIST', 'BRANSIS', 'BRANSISTSAFIRE', 'RANSIST']),
    ('DIGITEX', ['DIGITEX', 'DIGTEX', 'DIGITE', 'DIGFTEX']),
    ('Cvision', ['CVISION', 'CVISIONPLUS', 'CVBION']),
    ('CVS package', ['CVSPACKAGE', 'CVSF8PACKAGE', 'CVSPACKAG', 'VSPACKAGE', 'CVS']),
    ('MH', ['MH100', 'MH200S', 'MH100DIGITEX', 'MHIOO']),
]


def norm_txt(s):
    s = unicodedata.normalize('NFKC', s)
    s = s.upper()
    s = re.sub(r'[^A-Z0-9/+]', '', s)
    return s


def canon_system(raw):
    """Return (maker, model, family, confidence)."""
    # cut at option list: options appear after model, e.g. DSA, FPD, シネ, 3D, Net, ICT, CD
    head = raw[:60]
    n = norm_txt(head)
    # remove leading maker prefix leftovers (single char + circled)
    best_fam, best_sc = None, 0
    for fam, probes in FAMILIES:
        for p in probes:
            sc = fuzz.partial_ratio(p, n)
            # weight longer probes higher
            sc = sc * (1 - 0.25 / max(len(p), 2))
            if sc > best_sc:
                best_fam, best_sc = fam, sc
    if best_sc < 68:
        return None, raw.strip(), None, 0
    fam = best_fam
    maker = MAKER_BY_FAMILY[fam]
    model = fam
    if fam == 'Azurion':
        m = re.search(r'[13578]\s*[MBF]\s*[1I][025S]', n) or re.search(r'([BMF]\d{2})', n)
        gen = re.search(r'(?:AZURION|AANION|AARION|AZURIN|AURION)[^0-9]{0,3}([1357])', n)
        g = gen.group(1) if gen else '7'
        vm = re.search(r'([MBF])\s*(\d{2})', n)
        if vm:
            model = f'Azurion {g} {vm.group(1)}{vm.group(2)}'
        else:
            model = f'Azurion {g}'
    elif fam == 'Allura Xper':
        vm = re.search(r'FD\s*[BE]?(\d{1,2})\s*(?:[/1I]\s*(\d{1,2}))?', n)
        bip = 'BIPLANE' in n or 'BIPLAN' in n
        ortab = 'ORTABLE' in n or 'ORTAB' in n
        if vm:
            base = f'FD{vm.group(1)}'
            if vm.group(2):
                base += f'/{vm.group(2)}'
            model = f'Allura Xper {base}'
            if ortab:
                model += ' OR Table'
            elif bip:
                model += ' Biplane'
        else:
            model = 'Allura Xper'
    elif fam == 'Integris Allura':
        model = 'Integris Allura'
    elif fam == 'Integris':
        if 'CV' in n:
            model = 'Integris CV'
        elif 'H' in n:
            model = 'Integris H5000'
        else:
            model = 'Integris'
    elif fam == 'INFX':
        vm = re.search(r'8000\s*([VCFH])', n)
        sub = re.search(r'\(?(BP|SP|DP)\)?', n[n.find('8000'):] if '8000' in n else n)
        model = 'INFX-8000' + (vm.group(1) if vm else 'V')
        if sub:
            model += f'({sub.group(1)})'
    elif fam == 'Alphenix':
        if 'CORE' in n:
            model = 'Alphenix Core+' if 'CORE+' in n or 'COREt' in head else 'Alphenix Core'
        elif 'SKY' in n:
            model = 'Alphenix Sky+' if '+' in n else 'Alphenix Sky'
        elif 'BIPLANE' in n or 'BIPLAN' in n:
            model = 'Alphenix Biplane'
        elif 'HYBRID' in n:
            model = 'Alphenix Hybrid+' if '+' in n else 'Alphenix Hybrid'
        elif 'DUPLANE' in n or 'DUPLAN' in n:
            model = 'Alphenix Duplane'
        else:
            model = 'Alphenix'
    elif fam == 'Infinix Celeve':
        vm = re.search(r'CELEVE[^A-Z]{0,3}(CS|CC|CB|VS|VB|DP|I)', n)
        model = 'Infinix Celeve' + (f'-{vm.group(1)}' if vm else '')
    elif fam == 'ARTIS icono':
        model = 'ARTIS icono D-Spin' if 'DSPIN' in n or 'SPIN' in n else (
            'ARTIS icono Biplane' if 'BIPLANE' in n else 'ARTIS icono')
    elif fam == 'ARTIS pheno':
        model = 'ARTIS pheno'
    elif fam == 'Artis':
        if 'ZEEGO' in n:
            model = 'Artis zeego'
        elif 'ONE' in n:
            model = 'Artis one'
        elif re.search(r'ARTISU', n):
            model = 'Artis U'
        else:
            twin = 'TWIN' in n
            pure = 'PURE' in n
            q = re.search(r'ARTIS[^A-Z]{0,2}Q', n) or re.search(r'\bQ(BA|TA|BC)', n)
            izee = re.search(r'ZEE[^A-Z]{0,2}I|IBA|ITA', n)
            d = re.search(r'ARTIS[^A-Z]{0,2}D(TA|BC|FC|BA)', n)
            pos = re.search(r'(BA|BC|TA|FA|FC|TC|SX|MP|SB)', n.replace('TABLE', ''))
            p = pos.group(1) if pos else ''
            if d:
                model = f'Artis dTA' if d.group(1) == 'TA' else f'Artis d{d.group(1)}'
            elif q:
                model = f'Artis Q {p}'.strip() + (' Twin' if twin else '')
            elif izee:
                model = f'Artis zee i {p}'.strip()
            else:
                model = f'Artis zee {p}'.strip() + (' Twin' if twin else '') + (' PURE' if pure else '')
    elif fam == 'Innova':
        vm = re.search(r'([234]\d{3})\s*(IQ)?', n)
        if vm:
            model = f'Innova {vm.group(1)}' + (vm.group(2) or '')
        else:
            vm = re.search(r'(3131|212[12]?)(IQ)?', n)
            model = f'Innova {vm.group(1)}{vm.group(2) or ""}' if vm else 'Innova'
    elif fam in ('IGS', 'Allia IGS'):
        vm = re.search(r'([4567][234]0|520|530|540|620|630|740|730)', n)
        num = vm.group(1) if vm else ''
        if fam == 'Allia IGS' or 'ALLIA' in n:
            model = f'Allia IGS {num}'.strip()
        else:
            model = f'IGS {num}'.strip()
    elif fam == 'Discovery':
        vm = re.search(r'(7[34]0)', n)
        model = f'Discovery IGS {vm.group(1)}' if vm else 'Discovery'
    elif fam == 'Advantx':
        model = 'Advantx LCN' if 'LC' in n else ('Advantx UNV' if 'UNV' in n or 'UN' in n else 'Advantx')
    elif fam == 'ACT FP':
        model = 'ACT FP 4100'
    elif fam == 'Trinias':
        model = 'Trinias シリーズ'
    elif fam == 'BRANSIST safire':
        model = 'BRANSIST safire'
    elif fam == 'DIGITEX':
        if 'PREMIER' in n:
            model = 'DIGITEX Premier'
        elif 'SAFIRE' in n or 'SAFIR' in n:
            model = 'DIGITEX safire SP'
        elif 'PRO' in n:
            model = 'Cvision DIGITEX PRO-Multi'
        else:
            model = 'DIGITEX'
    elif fam == 'Cvision':
        model = 'Cvision Plus' if 'PLUS' in n else 'Cvision'
    elif fam == 'CVS package':
        model = 'CVS F8 package' if 'F8' in n else 'CVS package'
    elif fam == 'MH':
        model = 'MH-200S DIGITEX α' if '200' in n else 'MH-100 DIGITEX α'
    return maker, model, fam, best_sc


if __name__ == '__main__':
    import json, sys
    recs = json.load(open(sys.argv[1]))
    from collections import Counter
    c = Counter()
    unk = []
    for r in recs:
        for s in r['systems']:
            mk, md, fam, sc = canon_system(s)
            c[(mk, md)] += 1
            if mk is None:
                unk.append((r['hospital'], s[:50]))
    for k, v in sorted(c.items(), key=lambda x: -x[1]):
        print(v, k)
    print('--- unknown:', len(unk))
    for h, s in unk[:30]:
        print(' ', h, '|', s)
