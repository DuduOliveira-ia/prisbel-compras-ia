# Gera knowledge/referencia-precos-2026.csv a partir de docs/PLANILHA COMPRAS 2026.xlsx
# Uso: python scripts/gerar_referencia_precos.py
# Mediana ignora outliers de digitacao/frete embutido. Ver knowledge/referencia-precos-2026.md
import openpyxl, statistics, re, csv, datetime, os
from collections import defaultdict
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
wb = openpyxl.load_workbook(os.path.join(BASE,"docs","PLANILHA COMPRAS 2026.xlsx"), data_only=True)
ws = wb.worksheets[0]
agg = defaultdict(lambda: {"precos":[], "uni":defaultdict(int), "grupo":"", "n":0, "obras":set(), "ult":None})
for r in ws.iter_rows(min_row=3, values_only=True):
    if not r or not r[4]: continue
    desc = re.sub(r'\s+',' ', str(r[4]).strip().upper())
    a = agg[desc]; a["n"]+=1; a["grupo"]=(r[3] or '').strip()
    if r[6]: a["uni"][str(r[6]).strip()]+=1
    if r[0]: a["obras"].add(str(r[0]).strip())
    try:
        pu=float(r[7])
        if pu>0: a["precos"].append(pu)
    except: pass
    if isinstance(r[13], datetime.datetime) and (a["ult"] is None or r[13]>a["ult"]): a["ult"]=r[13]
out = os.path.join(BASE,"knowledge","referencia-precos-2026.csv")
with open(out,"w",newline="",encoding="utf-8") as f:
    w=csv.writer(f); w.writerow(["grupo","descricao","unidade","n_compras","preco_min","preco_mediana","preco_max","obras","ref_temporal"])
    n=0
    for desc,a in sorted(agg.items(), key=lambda x:(x[1]["grupo"], -x[1]["n"])):
        ps=a["precos"]
        if not ps: continue
        uni=max(a["uni"],key=a["uni"].get) if a["uni"] else ''
        ref=a["ult"].strftime("%Y-%m") if a["ult"] else ''
        w.writerow([a["grupo"],desc,uni,a["n"],f"{min(ps):.2f}",f"{statistics.median(ps):.2f}",f"{max(ps):.2f}","|".join(sorted(a["obras"]))[:60],ref]); n+=1
print("itens:", n)
