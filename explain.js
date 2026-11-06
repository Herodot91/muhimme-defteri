// Click-to-read explanations: what each number or method is, what it is based
// on, and whether a machine-learning model is involved. Opened from the column
// headers of the effect panel, the roadmap and the evidence tags.

const TEST_SUITES = [
  ['test_engine.py', 37, 'Potrivirea numelor de locuri (Kili, Bender, Eflak …), toleranța la diacritice, tema Anexare / Istimalet, împărțirea în hükümuri, perioade și ani.'],
  ['test_review.py', 35, 'Dovezi, corecțiile cercetătorului, curățarea fișierelor importate, compararea cercetătorilor, acuratețea, cifrele pentru raport.'],
  ['test_summary_volumes.py', 29, 'Citirea volumelor „Özet ve İndeks” (volumul 5): numere de pe pagină, note de subsol, date exacte, indexul tipărit, regula pentru Bender.'],
  ['test_contents_ocr.py', 16, 'Citirea cuprinsului unui volum scanat (volumul 91) după OCR: numere citite greșit, numere sărite, linii pierdute.'],
  ['test_network.py', 4, 'Pregătirea nodurilor și legăturilor pentru rețelele 3D.'],
  ['test_demo.py', 7, 'Datele demonstrative (fictive) din prototip: fixe, realiste, cu formatul real de fișier.'],
  ['test_docs.py', 2, 'Verifică faptul că numărul de teste din această explicație este cel real și că fiecare explicație din aplicație există.'],
];

function mlBadge(answer, text) {
  return `<p class="ex-ml ${answer ? 'yes' : 'no'}"><b>Model de învățare automată: ${answer ? 'da' : 'nu'}.</b> ${text}</p>`;
}

// Examples taken from the loaded volume: orders the simple search counts but the
// current engine does not.
function simpleOnlyExamples(limit) {
  const picked = new Map();
  for (const e of allEntries()) {
    const naive = naiveLabels(e), auto = e.auto || e;
    for (const kind of ['regions', 'fortresses']) {
      for (const label of naive[kind]) {
        if (auto[kind].includes(label) || picked.has(label)) continue;
        const term = NAME_REGISTRY.find(p => p.label === label).terms[0];
        const m = new RegExp(flexiblePattern(term), 'i').exec(textFor(e));
        if (m) picked.set(label, { e, label, index: m.index, match: m[0] });
      }
    }
    if (picked.size >= limit) break;
  }
  return [...picked.values()];
}

function simpleExamplesHtml() {
  if (!hasVolume()) {
    return `<p>Fără volum încărcat, un exemplu tipic: „kili” se găsește și în <em>kilise</em> (biserică), <em>Kırkkilise</em> (un oraș din Tracia) și <em>kılıç</em> (sabie), pentru că ı și i sunt tratate la fel. Încarcă un volum ca să vezi exemple din el.</p>`;
  }
  const ex = simpleOnlyExamples(4);
  if (!ex.length) return '<p>În volumul încărcat, căutarea simplă și motorul actual dau aceleași rezultate.</p>';
  return '<p>Hükümuri din volumul încărcat pe care căutarea simplă le numără, dar motorul actual nu:</p><ul class="ex-list">' +
    ex.map(x => `<li><b>${esc(x.label)}</b> — #${esc(x.e.num)}<div class="rv-snippet">${snippetHtml(textFor(x.e), x)}</div></li>`).join('') + '</ul>';
}

function engineRulesTableHtml() {
  const special = { 'Kili (Chilia)': 'cuvânt întreg, cu i punctat (exclude kilise, Kırkkilise, Kilis, kılıç)', 'Bender (Tighina)': 'cu majusculă, cuvânt întreg, fără „-i” după (exclude benderine = port, Bender-i Şihr)' };
  const variants = review.variants || {};
  return '<div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Loc</th><th>Termeni căutați</th><th>Regulă</th></tr></thead><tbody>' +
    NAME_REGISTRY.map(p => `<tr><td>${esc(p.label)}</td><td>${p.terms.concat(variants[p.label] || []).map(t => `<code>${esc(t)}</code>`).join(' ')}</td><td>${esc(special[p.label] || 'fragment de cuvânt, diacritice tolerate')}</td></tr>`).join('') +
    '</tbody></table></div>';
}

function themeRulesHtml() {
  return '<ul class="ex-list">' + Object.entries(THEME_TERMS).map(([theme, words]) =>
    `<li><b>${esc(theme)}</b>: ${words.map(w => `<code>${esc(w)}</code>`).join(' ')}</li>`).join('') + '</ul>';
}

const EXPLAIN = {
  simple: {
    title: 'Căutare simplă',
    html: () => `
      ${mlBadge(false, 'Este o căutare de text, nu o clasificare învățată din date.')}
      <h4>Ce este</h4>
      <p>Prima versiune a aplicației. Pentru fiecare loc caută în textul hükümului <b>primul său nume</b> din listă („eflak”, „bogdan”, „erdel”, „kili”, „akkerman”, „bender”, „hotin”, „silistre”) ca <b>fragment de cuvânt</b>, fără nicio excludere. Diacriticele sunt tolerate (ı = i, â = a, ş = s), la fel și spațiile rătăcite din PDF.</p>
      <h4>Pe ce se bazează</h4>
      <ul>
        <li>O expresie regulată pe fiecare loc. Nu există antrenare, scoruri sau probabilități.</li>
        <li>Același text dă mereu același rezultat.</li>
        <li>Orice apariție a literelor contează, chiar în interiorul altui cuvânt. De aceea numără prea mult.</li>
      </ul>
      <h4>De ce a rămas în aplicație</h4>
      <p>Ca punct de comparație: arată câte mențiuni s-ar număra fără corecțiile făcute ulterior.</p>
      <h4>Exemple</h4>
      ${simpleExamplesHtml()}`,
  },
  engine: {
    title: 'Motor actual',
    html: () => `
      ${mlBadge(false, 'Sunt reguli scrise de mână: liste de nume, expresii regulate și excluderi. Motorul nu învață din date.')}
      <h4>Ce este</h4>
      <p>Versiunea curentă a clasificării automate (versiunea ${esc(ENGINE_VERSION)}). Pentru fiecare hüküm se caută numele din <b>registrul de nume</b> și cuvintele-cheie ale temelor, apoi se păstrează pentru fiecare etichetă <b>termenul găsit și fragmentul</b> (dovada).</p>
      <h4>Pe ce se bazează</h4>
      <ul>
        <li><b>Registru de nume</b> (actualizarea 03): variantele fiecărui loc, plus cele adăugate de tine.</li>
        <li><b>Expresii regulate</b> tolerante la diacritice, vocale lungi (â, î, û) și spații rătăcite.</li>
        <li><b>Reguli de excludere</b> pentru cuvinte care seamănă cu numele unui loc.</li>
        <li><b>Textul analizat</b> depinde de volum: rezumat plus primele 2500 de caractere din text (volumul 3), destinatar plus rezumat (volumul 5), rezumatul din cuprins (volumul 91).</li>
        <li><b>Teme</b>: dacă apare oricare cuvânt-cheie din listă, tema se atribuie (fără scor sau pondere).</li>
      </ul>
      <h4>Locuri și reguli</h4>
      ${engineRulesTableHtml()}
      <h4>Teme și cuvinte-cheie</h4>
      ${themeRulesHtml()}
      <h4>Limite</h4>
      <p>Regulile nu înțeleg contextul: un cuvânt scris la fel dar cu alt sens poate fi numărat. De aceea fiecare etichetă are o dovadă pe care o poți verifica, iar potrivirile pe fragment de cuvânt sunt marcate „de verificat”.</p>
      <p class="rv-help"><button type="button" class="rv-linkish" data-explain="method">Metodologia detaliată pentru istorici, cu un test pe orice text</button></p>`,
  },
  corrected: {
    title: 'După corecții',
    html: () => {
      const t = reviewTotals();
      return `
        ${mlBadge(false, 'Sunt verdictele unui cercetător, nu ale unui model.')}
        <h4>Ce este</h4>
        <p>Etichetele motorului actual, minus cele pe care le-ai marcat <b>Greșit</b>, plus cele pe care le-ai adăugat ca lipsă. Toate cifrele, hărțile, graficele și tabelele din aplicație se calculează din aceste etichete corectate.</p>
        <h4>Pe ce se bazează</h4>
        <ul>
          <li>Butoanele Corect / Greșit de lângă dovezi (pe hartă, în Documente, în Actualizări).</li>
          <li>Corecțiile se păstrează numai în acest browser; se pot exporta și compara cu ale colegilor.</li>
        </ul>
        <h4>Acum</h4>
        <p>${t.ok} confirmate, ${t.no} respinse, ${t.added} adăugate, în ${t.entries} hükümuri.</p>`;
    },
  },
  effect: {
    title: 'Efect',
    html: () => `
      ${mlBadge(false, 'Este o simplă scădere.')}
      <p>Efect = numărul <b>după corecții</b> minus numărul din <b>căutarea simplă</b>. Un număr negativ înseamnă că potrivirile pe fragmente de cuvânt, cele care nu erau de fapt locul căutat, au fost eliminate.</p>`,
  },
  partial: {
    title: 'Cuvânt întreg și potrivire parțială',
    html: () => `
      ${mlBadge(false, 'Verificarea se face cu o regulă simplă pe literele din jurul termenului.')}
      <p><b>Cuvânt întreg</b>: termenul găsit nu este lipit de alte litere (de exemplu „Eflâk’e”: apostroful nu este literă).</p>
      <p><b>Potrivire parțială</b>: termenul este lipit de litere, deci poate fi o formă flexionată („Eflake”) sau o parte dintr-un alt cuvânt („Kırkkilise”). Merită verificată cu butoanele Corect / Greșit.</p>`,
  },
  method: {
    title: 'Metodologie: cum se face clasificarea automată',
    after: dlg => {
      const box = dlg.querySelector('#method-try');
      const out = dlg.querySelector('#method-result');
      if (!box || !out) return;
      const run = () => { out.innerHTML = methodTryHtml(box.value); };
      box.addEventListener('input', run);
      run();
    },
    html: () => `
      <p class="ex-ml no"><b>Model de învățare automată: nu.</b> Clasificarea automată este un algoritm de reguli: liste de nume și cuvinte-cheie, transformate în expresii regulate. Nu există model antrenat, date de antrenare, scoruri sau probabilități.</p>
      <h4>Răspuns scurt</h4>
      <div class="rv-table-wrap"><table class="rv-table"><tbody>
        <tr><th scope="row">Cum se clasifică?</th><td>Cu <b>reguli scrise de oameni</b>: liste de nume și cuvinte-cheie căutate în text.</td></tr>
        <tr><th scope="row">Ce algoritm?</th><td>Potrivire de <b>expresii regulate</b>; dacă oricare termen din listă apare în text, eticheta se atribuie („SAU” logic). Fără scor, fără probabilități.</td></tr>
        <tr><th scope="row">Python?</th><td>Nu pentru clasificare. Clasificarea este scrisă în <b>JavaScript</b> și rulează în browserul tău. Python se folosește doar pentru testele automate (pytest) și pentru prima versiune a aplicației, nefolosită acum.</td></tr>
        <tr><th scope="row">Model de învățare automată?</th><td><b>Niciunul.</b> Nu există model antrenat, deci nu există un nume de model de indicat.</td></tr>
        <tr><th scope="row">Unde există totuși învățare automată?</th><td>(1) <b>OCR</b>: Tesseract.js (rețea neuronală LSTM, model pentru limba turcă) citește literele din paginile scanate ale volumului 91; (2) <b>traducerea</b>: un model lingvistic (Claude, prin Puter.js), doar când apeși „Tradu”. Niciunul nu alege etichete.</td></tr>
      </tbody></table></div>
      <h4>Ce cod s-a scris</h4>
      <ul>
        <li><b>JavaScript, în browser</b>: fișierul <code>engine.js</code> (citirea și împărțirea volumelor, clasificarea, dovezile, logica verificării). Aceasta este singura clasificare folosită de site. Nimic nu se trimite unui server.</li>
        <li><b>Python</b>: (1) <code>muhimme_app.py</code>, prima versiune a aplicației (Streamlit, 9 august 2026), cu aceleași liste de cuvinte-cheie, dar fără regulile și corecțiile ulterioare, nefolosită acum de site; (2) testele (pytest), care rulează <code>engine.js</code> prin Node și verifică rezultatele.</li>
        <li>Codul este public: <a href="https://github.com/Herodot91/muhimme-defteri/blob/main/engine.js" target="_blank" rel="noopener">engine.js</a>. Funcțiile principale sunt <code>flexiblePattern</code>, <code>termRegex</code> și <code>classifyText</code>.</li>
      </ul>
      <h4>Algoritmul, pas cu pas</h4>
      <ol>
        <li><b>Textul</b> se extrage din PDF (PDF.js). La volumele scanate (volumul 91) se folosește OCR, singurul loc din procesul de selecție în care intervine învățarea automată, și doar pentru a citi literele.</li>
        <li><b>Împărțirea în hükümuri</b> se face cu expresii regulate (număr, destinatar, „:”, „Yazıldı” sau, la volumul 5, rândurile de pe pagină și listele de numere; la volumul 91, rândurile cuprinsului).</li>
        <li><b>Textul analizat</b> pentru fiecare hüküm: rezumat plus primele 2500 de caractere din text (volumul 3); destinatar plus rezumat (volumul 5); rezumatul din cuprins (volumul 91).</li>
        <li>Fiecare <b>etichetă</b> (regiune, cetate, temă) are o <b>listă de termeni</b>, de exemplu Eflak: <code>eflak</code>. Fiecare termen devine o <b>expresie regulată</b>: fiecare literă este înlocuită cu variantele ei (<code>a → [aàâ]</code>, <code>i → [iıİIî]</code>, <code>s → [sş]</code>, <code>g → [gğ]</code> …) și între litere se admit spații, pentru că PDF-urile scriu uneori „Bo ğ dan”. Exemplu real: <code>eflak</code> devine <code>${esc(flexiblePattern('eflak'))}</code>.</li>
        <li><b>Regula de decizie</b>: dacă <b>oricare</b> termen din listă se potrivește oriunde în text (fără distincție între majuscule și minuscule), eticheta se atribuie. Este un „SAU” logic. Nu există scor, pondere sau prag.</li>
        <li><b>Excepții scrise de mână</b>: <code>Kili</code> trebuie să fie cuvânt întreg cu i punctat (<code>${esc(termRegex('kili').source)}</code>), ca să nu prindă <em>kilise</em>, <em>Kırkkilise</em>, <em>kılıç</em>; <code>Bender</code> trebuie scris cu majusculă, ca cuvânt întreg și fără „-i” după (<code>${esc(termRegex('bender').source)}</code>), pentru că „bender” înseamnă și „port”.</li>
        <li><b>Dovada</b>: pentru fiecare etichetă se păstrează termenul găsit, locul și dacă a fost cuvânt întreg sau potrivire parțială (prima apariție ca cuvânt întreg, altfel prima apariție).</li>
        <li><b>Verdictele cercetătorului</b> (Corect / Greșit / adăugat) se aplică peste etichetele automate; toate cifrele din aplicație se calculează din etichetele corectate.</li>
      </ol>
      <h4>Încearcă motorul pe un text</h4>
      <p>Scrie sau lipește un text și vezi exact ce etichete ar primi și de ce. Rezultatul este calculat chiar acum de codul de mai sus.</p>
      <textarea id="method-try" class="ex-try" rows="3" aria-label="Text de încercat">Kili Kalesi'ne ve Eflâk voyvodasına yazıldı; kilise yapıldı, Basra benderine kılıç gönderildi.</textarea>
      <div id="method-result" class="ex-try-result" aria-live="polite"></div>
      <h4>Ce nu face</h4>
      <ul>
        <li>Nu înțelege sensul sau contextul: dacă un cuvânt scris la fel are alt sens și nu este acoperit de o excepție scrisă de mână, va fi numărat.</li>
        <li>Nu găsește un loc scris sub un nume care nu este în registru (poți adăuga variante în actualizarea 03).</li>
        <li>Temele sunt cele mai slabe: cuvintele-cheie sunt scurte (<code>bac</code>, <code>kale</code>, <code>sefer</code>) și apar des în alte cuvinte; multe potriviri sunt marcate „de verificat”.</li>
      </ul>
      <h4>Cine a ales listele de cuvinte</h4>
      <p>Listele pentru regiuni, cetăți și primele patru teme (Comerț, Administrație, Militar / Securitate, Diplomație) sunt din prima versiune a aplicației. Tema Anexare / Istimalet, variantele din registru și excluderile au fost adăugate ulterior, după verificări pe volumele reale („ilhak” și „himaye” au fost scoase pentru că dădeau potriviri fără legătură). <b>Listele nu au fost validate de istorici.</b> Este un punct de revizuit: orice istoric poate vedea listele aici (butonul „Motor actual”) și le poate corecta prin verdicte și variante.</p>
      <h4>Reproductibilitate</h4>
      <p>Același text dă mereu același rezultat. Versiunea motorului (${esc(ENGINE_VERSION)}) se înscrie în exporturi. Comportamentul este fixat de teste automate (vezi „Teste automate”).</p>
      <p class="rv-help"><button type="button" class="rv-linkish" data-explain="ml">Unde se folosește învățarea automată în aplicație</button> · <button type="button" class="rv-linkish" data-explain="engine">Listele de termeni, pe locuri și teme</button></p>`,
  },
  ml: {
    title: 'Învățare automată: unde se folosește și unde nu',
    html: () => `
      <p class="ex-ml no"><b>Clasificarea (regiuni, cetăți, teme) nu folosește învățare automată.</b> Nu există un model antrenat pentru selecție.</p>
      <p class="rv-help"><button type="button" class="rv-linkish" data-explain="method">Cum se face clasificarea, pas cu pas</button></p>
      <div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Componentă</th><th>Cum funcționează</th><th>Învățare automată?</th></tr></thead><tbody>
        <tr><td>Clasificarea în regiuni, cetăți și teme</td><td>Liste de nume, cuvinte-cheie, expresii regulate, excluderi</td><td><b>Nu</b></td></tr>
        <tr><td>Împărțirea în hükümuri, numere, date, index</td><td>Expresii regulate și reguli de aliniere pe pagină</td><td><b>Nu</b></td></tr>
        <tr><td>Citirea PDF-urilor cu text</td><td>PDF.js extrage textul din fișier</td><td><b>Nu</b></td></tr>
        <tr><td>Citirea PDF-urilor scanate (OCR)</td><td>Tesseract.js, modelul pentru limba turcă; o rețea neuronală recunoaște literele din imagine</td><td><b>Da</b>, doar pentru a citi pagini scanate (volumul 91), nu pentru a alege etichete</td></tr>
        <tr><td>Traducerea în română</td><td>Puter.js trimite textul hükümului ales unui model lingvistic (Claude), doar când apeși „Tradu”</td><td><b>Da</b>, la cerere</td></tr>
        <tr><td>Rețelele 3D</td><td>Algoritm de forțe (aranjare de grafuri)</td><td><b>Nu</b></td></tr>
        <tr><td>Acuratețea măsurată</td><td>Verdictele tale Corect / Greșit, împărțite la numărul de etichete verificate</td><td><b>Nu</b></td></tr>
      </tbody></table></div>
      <h4>De ce reguli și nu un model</h4>
      <ul>
        <li>Fiecare etichetă poate fi justificată cu termenul și fragmentul găsit.</li>
        <li>Nu există încă un set mare de hükümuri etichetate de specialiști pe care să se antreneze și să se evalueze un model.</li>
      </ul>
      <h4>Ce ar putea urma</h4>
      <p>Verdictele Corect / Greșit și eșantionul verificat de mână (actualizarea 06) ar putea deveni date de antrenare și de evaluare pentru un model de clasificare. Până atunci, aplicația nu pretinde nicio acuratețe pe care nu a măsurat-o.</p>`,
  },
  tests: {
    title: 'Teste automate',
    html: () => {
      const total = TEST_SUITES.reduce((n, s) => n + s[1], 0);
      return `
        ${mlBadge(false, 'Testele sunt verificări obișnuite de cod, nu un model.')}
        <h4>Ce sunt</h4>
        <p>${total} de teste scrise cu <b>pytest</b>. Fiecare ia un fragment scurt de text sau de date, rulează motorul (<code>engine.js</code>, prin Node) și verifică dacă rezultatul este exact cel așteptat. De exemplu: „<em>kilise yapıldı</em>” nu trebuie să dea cetatea Kili, iar „<em>Bender Kalesi’nde</em>” trebuie să dea Bender.</p>
        <div class="rv-table-wrap"><table class="rv-table"><thead><tr><th>Fișier</th><th>Teste</th><th>Ce verifică</th></tr></thead><tbody>
          ${TEST_SUITES.map(([f, n, what]) => `<tr><td><code>${esc(f)}</code></td><td>${n}</td><td>${esc(what)}</td></tr>`).join('')}
        </tbody></table></div>
        <h4>Despre „fragmente din alte volume”</h4>
        <p>Testele folosesc fragmente scurte <b>inventate după tiparele</b> volumelor 5 și 91 (pagini de rezumate cu numere, cuprins cu rânduri strâmbe de la OCR), nu volumele întregi. Volumele reale au fost verificate în aplicație: de exemplu volumul 5 față de indexul său tipărit, unde motorul găsește 89% din mențiunile indexate. Ce lipsește încă: teste pe fragmente reale din fiecare volum și pe volume noi.</p>
        <p>Cifrele de mai sus sunt cele de la versiunea ${esc(ENGINE_VERSION)}. Ele se pot rula pe calculator cu <code>python -m pytest</code> în dosarul proiectului.</p>`;
    },
  },
  agreement: {
    title: 'Acord pe etichetă',
    html: () => `
      ${mlBadge(false, 'Este o numărătoare a verdictelor a doi sau mai mulți cercetători.')}
      <h4>Ce arată</h4>
      <p>Pentru fiecare etichetă (de exemplu „Kili” sau „Administrație”) se numără etichetele atribuite unor hükümuri pe care au dat verdict cel puțin două persoane. Bara verde = verdictele au fost la fel (toți au confirmat sau toți au respins); bara roșie = verdictele au fost diferite.</p>
      <h4>Cum se calculează</h4>
      <p><b>Acord</b> = etichete cu verdicte la fel ÷ etichete verificate de cel puțin două persoane. Exemplu: dacă A confirmă eticheta „Kili” la un hüküm și B o respinge, e un dezacord; dacă amândoi o confirmă, e acord.</p>
      <h4>Limite</h4>
      <p>Nu este un test statistic și nu ține cont de acordul întâmplător. Cu puține etichete verificate procentul este nesigur.</p>
      ${protoNote()}`,
  },
  precision: {
    title: 'Precizia etichetelor, pe cercetător',
    html: () => `
      ${mlBadge(false, 'Este o fracție calculată din verdictele cercetătorului, nu o măsură a unui model.')}
      <h4>Ce arată</h4>
      <p>Cât din etichetele automate verificate de un cercetător le-a confirmat el.</p>
      <h4>Cum se calculează</h4>
      <p><b>Precizie</b> = etichete confirmate ÷ (confirmate + respinse). Exemplu: dacă un cercetător a verificat 10 etichete „Kili” și a confirmat 7, precizia este 70%. Etichetele fără verdict nu intră în calcul.</p>
      <h4>Limite</h4>
      <p>Spune cât de bune sunt etichetele <i>după părerea fiecărui cercetător</i>. Cercetători diferiți pot avea precizii diferite pentru aceeași etichetă: tocmai asta arată graficul. Pentru o estimare utilă a acurateței motorului trebuie un eșantion aleatoriu (actualizarea 06).</p>
      ${protoNote()}`,
  },
  recall: {
    title: 'Acoperire estimată',
    html: () => `
      ${mlBadge(false, 'Este o fracție calculată din verdicte.')}
      <p><b>Acoperire estimată</b> = etichete confirmate ÷ (confirmate + etichete adăugate de cercetător ca lipsă). Arată cât din ce ar fi trebuit găsit a fost găsit de motor, în hükümurile verificate. Este doar o estimare: ce nu a observat nimeni nu apare nicăieri.</p>
      ${protoNote()}`,
  },
  verdicts: {
    title: 'Verdicte pe cercetător',
    html: () => `
      ${mlBadge(false, 'Sunt simple numărători.')}
      <p>Pentru fiecare cercetător: câte etichete a <b>confirmat</b> (Corect), a <b>respins</b> (Greșit) și a <b>adăugat</b> ca lipsă. Arată cât a verificat fiecare și cât de critic a fost față de motor.</p>
      ${protoNote()}`,
  },
  counts: {
    title: 'Mențiuni pe loc',
    html: () => `
      ${mlBadge(false, 'Aceleași cifre ca în panoul de efect, ca grafic.')}
      <p>Pentru fiecare loc: câte hükümuri numără căutarea simplă, motorul actual și cifra după corecții. Diferența dintre prima și ultima bară este efectul corectărilor motorului și al verdictelor.</p>`,
  },
  proto: {
    title: 'Date demonstrative (prototip)',
    html: () => `
      ${mlBadge(false, 'Datele demonstrative sunt produse de o formulă fixă, nu de un model.')}
      <h4>Ce sunt</h4>
      <p>Aplicația este un prototip. Ca să poți vedea acordul pe etichetă, precizia și celelalte grafice fără colegi reali, poți încărca trei cercetători <b>fictivi</b> („Demonstrativ A, B, C”). Verdictele lor sunt calculate de o formulă fixă: A are încredere în potrivirile pe cuvânt întreg și le respinge pe cele parțiale; B și C se abat de la A în unele cazuri, deci acordul nu este nici 0%, nici 100%.</p>
      <h4>Ce poți face</h4>
      <ul>
        <li><b>Încarcă exemplul demonstrativ</b>: apar graficele și comparația, calculate exact ca pentru date reale. Cu un volum încărcat, exemplul folosește hükümuri din volumul tău; fără volum, folosește hükümuri fictive.</li>
        <li><b>Descarcă fișiere demonstrative</b>: trei fișiere JSON în formatul real de export, ca să încerci importul de la colegi.</li>
        <li><b>Raport PDF demonstrativ</b>: raportul cu grafice, generat din datele fictive, fără să atingă verdictele tale.</li>
      </ul>
      <p>Datele fictive nu sunt verdicte reale și nu trebuie citate. Raportul și fișierele le marchează „fictiv”.</p>`,
  },
  collab: {
    title: 'Verificare colaborativă: la ce folosește',
    html: () => `
      ${mlBadge(false, 'Compară verdictele a doi sau mai mulți cercetători; nu folosește niciun model.')}
      <h4>Scopul, pe scurt</h4>
      <p>Aplicația găsește singură locurile (Kili, Eflak, Akkerman…) în hükümuri, dar <b>poate greși</b>, iar listele ei de cuvinte nu au fost validate de istorici. <b>Verificarea colaborativă</b> înseamnă că mai mulți cercetători controlează aceleași rezultate, fiecare separat, iar aplicația arată <b>unde sunt de acord și unde nu</b>. Scopul este să știm cât ne putem baza pe etichete și unde merită discutat.</p>
      <h4>De ce nu ajunge o singură persoană</h4>
      <ul>
        <li>O singură persoană poate greși sau poate înțelege un fragment altfel decât alta.</li>
        <li>Dacă <b>doi oameni judecă la fel</b>, rezultatul este mai sigur. Dacă <b>judecă diferit</b>, tocmai acolo este ceva de discutat: un text neclar, un nume cu două sensuri sau o regulă a aplicației care trebuie corectată.</li>
        <li>Site-ul nu are server, deci nu poate aduna singur părerile; fiecare le păstrează în browserul lui și le trimite colegilor sub formă de fișier.</li>
      </ul>
      <h4>Un exemplu</h4>
      <p>Hüküm nr. 12 a primit de la aplicație eticheta „Kili”. Ana o marchează <b>Corect</b>. Mihai o marchează <b>Greșit</b>, pentru că textul vorbește de o <em>kilise</em> (biserică), nu de cetatea Kili. Aplicația notează un <b>dezacord</b> la hükümul 12 și arată ambele verdicte lângă fragmentul din text. Cei doi discută și decid; dacă Mihai are dreptate, regula pentru „Kili” poate fi strânsă.</p>
      <h4>Pașii</h4>
      <ol>
        <li>Fiecare cercetător marchează etichetele cu <b>Corect</b> / <b>Greșit</b> în fila „Actualizări”, la „Corecții ale cercetătorului”. Corecțiile rămân în browserul lui.</li>
        <li>Își <b>exportă</b> corecțiile într-un fișier (JSON sau CSV) și îl trimite colegilor.</li>
        <li>Colegii <b>importă</b> fișierul în aplicație, la „Verificare colaborativă”.</li>
        <li>Aplicația arată <b>acordul pe etichetă</b>, precizia fiecăruia, tabelul dezacordurilor și poate genera un <b>raport PDF cu grafice</b>.</li>
      </ol>
      <h4>Ce obții</h4>
      <ul>
        <li>Cât la sută din etichetele verificate de cel puțin doi oameni au primit același verdict.</li>
        <li>Care etichete (de exemplu Kili, Bender sau o temă) provoacă cele mai multe dezacorduri.</li>
        <li>Lista exactă a hükümurilor în care părerile diferă, ca să le discutați.</li>
        <li>Un raport PDF pe care îl poți arăta sau atașa unei lucrări.</li>
      </ul>
      <h4>Ce nu este</h4>
      <ul>
        <li>Nu decide cine are dreptate: dezacordul rămâne în seama oamenilor (poți doar adopta verdictul unui coleg).</li>
        <li>Nu antrenează niciun model și nu schimbă singură regulile motorului.</li>
        <li>Nu trimite nimic pe internet: fișierele circulă între voi, nu prin site.</li>
      </ul>
      <p class="rv-help">Încă nu ai colegi? Folosește exemplul demonstrativ din prototip ca să vezi cum arată graficele: <button type="button" class="rv-linkish" data-explain="proto">Despre datele demonstrative</button></p>
      <h4>Ce înseamnă „acord”</h4>
      <p>Două verdicte sunt la fel dacă amândouă confirmă eticheta (inclusiv când o adaugă ca lipsă) sau amândouă o resping. Procentul de acord este numărul de etichete cu verdicte la fel împărțit la numărul de etichete verificate de cel puțin două persoane. Nu este un test statistic și nu corectează pentru acordul întâmplător.</p>
      <h4>Raportul PDF</h4>
      <p>Raportul cuprinde rezumatul, graficele (verdicte pe cercetător, acord pe etichetă, precizie pe cercetător, cifrele pe locuri) și tabelul dezacordurilor.</p>`,
  },
};

// Live result of the real engine on a text typed in the methodology dialog.
function methodTryHtml(text) {
  const t = String(text || '').slice(0, 3000);
  if (!t.trim()) return '<p class="rv-none">Scrie un text.</p>';
  const c = classifyText(t, review.variants);
  const naive = classifyNaive(t);
  const labels = [...c.regions, ...c.fortresses, ...c.themes];
  const naiveLabels = [...naive.regions, ...naive.fortresses];
  const onlyNaive = naiveLabels.filter(l => !labels.includes(l));
  const items = c.evidence.map(ev => `<li><b>${esc(ev.label)}</b> <span class="rv-term">(${KIND_NAME[ev.kind]}; termen: ${esc(ev.term)})</span>
    <span class="rv-tag ${ev.wholeWord ? 'whole' : 'partial'}">${ev.wholeWord ? 'cuvânt întreg' : 'potrivire parțială'}</span>
    <div class="rv-snippet">${snippetHtml(t, ev)}</div></li>`).join('');
  return `${items ? `<ul class="ex-list">${items}</ul>` : '<p class="rv-none">Nicio etichetă pentru acest text.</p>'}
    ${onlyNaive.length ? `<p class="rv-help"><b>Căutarea simplă ar fi numărat în plus:</b> ${onlyNaive.map(esc).join(', ')} (potriviri pe fragment de cuvânt, respinse de reguli).</p>` : ''}`;
}

function protoNote() {
  return '<p class="rv-help"><button type="button" class="rv-linkish" data-explain="proto">Despre datele demonstrative din prototip</button></p>';
}

function ensureExplainDialog() {
  let dlg = document.getElementById('explain-dialog');
  if (dlg) return dlg;
  dlg = document.createElement('dialog');
  dlg.id = 'explain-dialog';
  dlg.className = 'explain-dialog';
  dlg.innerHTML = '<div class="ex-head"><h3 id="explain-title"></h3><button type="button" class="ex-close" id="explain-close" aria-label="Închide explicația">Închide</button></div><div id="explain-body" class="ex-body"></div>';
  document.body.appendChild(dlg);
  dlg.querySelector('#explain-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('click', ev => { if (ev.target === dlg) dlg.close(); });
  return dlg;
}

function showExplanation(key) {
  const item = EXPLAIN[key];
  if (!item) return;
  const dlg = ensureExplainDialog();
  dlg.querySelector('#explain-title').textContent = item.title;
  dlg.querySelector('#explain-body').innerHTML = item.html();
  if (!dlg.open) dlg.showModal();
  dlg.querySelector('#explain-body').scrollTop = 0;
  if (item.after) item.after(dlg);
}

document.addEventListener('click', ev => {
  const trigger = ev.target.closest('[data-explain]');
  if (trigger) { ev.preventDefault(); showExplanation(trigger.dataset.explain); }
});
