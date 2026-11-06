# Mühimme Defterleri — Metode digitale în prelucrarea materialelor arhivistice otomane publicate

**Aplicație live:** https://herodot91.github.io/muhimme-defteri/

Rezultat al comunicării științifice *„Metode digitale în prelucrarea
materialelor arhivistice otomane publicate: cazul Mühimme Defterleri”*.

Aplicația transformă informațiile din **Mühimme Defterleri** (registrele
otomane de ordine imperiale) într-un corpus structurat care permite analiza
cronologică, geografică, tematică și relațională a mențiunilor privind
**Eflak** (Țara Românească), **Boğdan** (Moldova) și **Erdel** (Ardeal /
Transilvania), plus cetățile anexate de la granița dunăreano-nistreană
(Kili, Akkerman, Bender, Hotin, Silistre).

## Cum se folosește

Deschide aplicația și încarcă unul sau mai multe volume Mühimme Defterleri
(PDF) din bara laterală. Site-ul este static: tot ce se face rămâne în
browserul tău, iar PDF-ul nu este trimis nicăieri. Sunt citite trei feluri de
volume: rezumat plus transcriere (volumul 3), doar rezumate și index
(volumul 5) și volume scanate (volumul 91, doar cuprinsul, prin OCR).

Fără niciun volum încărcat, aplicația arată un corpus demonstrativ fictiv.

## Metodologie: cum se face clasificarea automată

**Clasificarea nu folosește învățare automată.** Este un algoritm de reguli:

1. Fiecare etichetă (regiune, cetate, temă) are o listă de termeni.
2. Fiecare termen devine o expresie regulată care tolerează diacriticele
   otomane (`a → [aàâ]`, `i → [iıİIî]`, `s → [sş]` …) și spațiile rătăcite din
   PDF („Bo ğ dan”).
3. Dacă oricare termen se potrivește în textul hükümului, eticheta se atribuie
   (un „SAU” logic). Nu există scor, pondere, prag sau probabilitate.
4. Pentru *Kili* și *Bender*, care seamănă cu alte cuvinte (*kilise*, *kılıç*,
   „bender” = port), există reguli de excludere scrise de mână.
5. Pentru fiecare etichetă se păstrează dovada: termenul găsit și fragmentul.
6. Verdictele cercetătorului (Corect / Greșit / adăugat) se aplică peste
   etichetele automate.

Același text dă mereu același rezultat. Listele de cuvinte-cheie **nu au fost
validate de istorici**; ele sunt vizibile în aplicație („Motor actual”) și pot
fi corectate prin verdicte și prin variante noi în registrul de nume. În
aplicație, butonul „Metodologie pentru istorici” explică totul în detaliu și
permite încercarea motorului pe orice text.

### Unde se folosește totuși învățarea automată

- **OCR** (Tesseract.js, modelul pentru limba turcă): doar pentru a citi
  paginile scanate ale volumului 91, nu pentru a alege etichete.
- **Traducerea în română** (Puter.js, un model lingvistic): doar când apeși
  „Tradu” și numai pentru textul hükümului ales.

Rezultatele sunt o extragere euristică, nu o adnotare filologică validată
manual. Fiecare rezultat afișează rezumatul și, unde există, textul
hükümului, pentru verificare la sursă.

## Cod

- `engine.js` — motorul: citirea și împărțirea volumelor, clasificarea,
  dovezile, logica verificării.
- `app.js`, `updates.js`, `explain.js`, `report.js` — interfața.
- `tests/` — teste automate (pytest) care rulează `engine.js` prin Node.
- `muhimme_app.py` — prima versiune (Streamlit); nu mai este folosită de site
  și nu are regulile și corecțiile ulterioare.

```bash
pip install pytest
python -m pytest
```
