# Mühimme Defterleri — Metode digitale în prelucrarea materialelor arhivistice otomane publicate

Rezultat final al comunicării științifice *„Metode digitale în prelucrarea
materialelor arhivistice otomane publicate: cazul Mühimme Defterleri”*.

Aplicația transformă informațiile din **Mühimme Defterleri** (registrele
otomane de ordine imperiale) într-un corpus structurat care permite analiza
cronologică, geografică, tematică și relațională a mențiunilor privind
**Eflak** (Țara Românească), **Boğdan** (Moldova) și **Erdel** (Ardeal /
Transilvania), plus cetățile anexate de la granița dunăreano-nistreană
(Kili, Akkerman, Bender, Hotin, Silistre).

## Rulare locală

```bash
pip install -r requirements.txt
streamlit run muhimme_app.py
```

## Utilizare

1. Încarcă unul sau mai multe volume Mühimme Defterleri (PDF) din bara
   laterală.
2. Filele principale (Corpus, Cronologie, Teme, Hartă, Rețele, Comparație,
   Documente) comută automat la datele reale extrase din volumul încărcat.
3. Fila „Volum PDF” rămâne pentru gestionarea volumelor sursă (listă,
   vizualizare, căutare brută).

Fără niciun volum încărcat, aplicația arată un corpus demonstrativ fictiv,
folosit doar pentru a ilustra mecanismele interfeței.

## Notă metodologică

Clasificarea pe teme și regiuni este automată, pe bază de cuvinte-cheie și
potrivire flexibilă a diacriticelor otomane — o extragere euristică, nu o
adnotare filologică validată manual. Fiecare rezultat afișează rezumatul și
textul integral al hükümului pentru verificare la sursă.
