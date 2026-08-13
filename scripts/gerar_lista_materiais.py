# -*- coding: utf-8 -*-
"""Gera a lista de materiais da Prisbel a partir do histórico real de compras
(knowledge/referencia-precos-2026.csv, destilado da PLANILHA COMPRAS 2026).

Saída: knowledge/lista-materiais-2026.csv com um registro por GRUPO real:
  grupo | itens_distintos | compras | unidades | nbr_citadas | exemplos
As NBRs são EXTRAÍDAS dos próprios descritivos de compra (não inventadas):
a planilha traz coisas como "... NBR13816, 13817, 13818 15463 e ISO 10545".

Uso: python scripts/gerar_lista_materiais.py
"""
import csv, io, re, collections, os

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENTRADA = os.path.join(BASE, 'knowledge', 'referencia-precos-2026.csv')
SAIDA_GRUPOS = os.path.join(BASE, 'knowledge', 'lista-materiais-2026.csv')
SAIDA_NBR = os.path.join(BASE, 'knowledge', 'nbr-encontradas-2026.csv')

rows = list(csv.DictReader(io.open(ENTRADA, encoding='utf-8')))

# NBR / ISO citadas no próprio descritivo do material comprado
re_nbr = re.compile(r'NBR\s*[-–]?\s*(\d{4,5})', re.I)
re_iso = re.compile(r'ISO\s*[-–]?\s*(\d{3,5})', re.I)

por_grupo = collections.OrderedDict()
nbr_por_grupo = collections.defaultdict(collections.Counter)
achados_nbr = []

for r in rows:
    g = (r['grupo'] or 'SEM GRUPO').strip()
    d = (r['descricao'] or '').strip()
    if g not in por_grupo:
        por_grupo[g] = {'itens': 0, 'compras': 0, 'unidades': collections.Counter(),
                        'exemplos': [], 'precos': []}
    e = por_grupo[g]
    e['itens'] += 1
    try:
        e['compras'] += int(r['n_compras'] or 0)
    except ValueError:
        pass
    if r['unidade']:
        e['unidades'][r['unidade'].strip()] += 1
    if len(e['exemplos']) < 3 and d:
        e['exemplos'].append(d[:70])
    try:
        e['precos'].append(float(r['preco_mediana']))
    except (ValueError, TypeError):
        pass
    normas = ['NBR ' + n for n in re_nbr.findall(d)] + ['ISO ' + n for n in re_iso.findall(d)]
    for n in normas:
        nbr_por_grupo[g][n] += 1
    if normas:
        achados_nbr.append({'grupo': g, 'material': d[:120], 'normas': ' | '.join(sorted(set(normas)))})

with io.open(SAIDA_GRUPOS, 'w', encoding='utf-8', newline='') as f:
    w = csv.writer(f)
    w.writerow(['grupo', 'itens_distintos', 'compras_no_periodo', 'unidades_usadas',
                'nbr_citadas_no_historico', 'exemplos_de_material'])
    for g, e in sorted(por_grupo.items(), key=lambda kv: -kv[1]['itens']):
        unidades = ', '.join(u for u, _ in e['unidades'].most_common(4))
        nbrs = ', '.join(n for n, _ in nbr_por_grupo[g].most_common(6))
        w.writerow([g, e['itens'], e['compras'], unidades, nbrs, ' ; '.join(e['exemplos'])])

with io.open(SAIDA_NBR, 'w', encoding='utf-8', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['grupo', 'material', 'normas'])
    w.writeheader()
    for a in achados_nbr:
        w.writerow(a)

print('grupos:', len(por_grupo), '-> ', SAIDA_GRUPOS)
print('materiais com norma citada:', len(achados_nbr), '-> ', SAIDA_NBR)
print('\nNORMAS ENCONTRADAS NO HISTORICO (por grupo):')
for g in por_grupo:
    if nbr_por_grupo[g]:
        print('  %-22s %s' % (g, ', '.join(n for n, _ in nbr_por_grupo[g].most_common(8))))
