'use strict';

// 내용 데이터(appData, acupointDictionary)는 data.js에 있습니다.

const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400?text=No+Image';

const navHeader = document.getElementById('nav-header');
const subTabWrapper = document.getElementById('sub-tab-wrapper');
const contentCard = document.getElementById('contentCard');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

/* ---------- 공통 도구 ---------- */

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findCategory(catId) {
    return appData.categories.find(c => c.id === catId);
}

/* ---------- 본문 변환 (자침 방향 아이콘, 혈자리 토글) ---------- */

function parseDirectionIcons(text) {
    if (!text) return "";
    return text
        .replace(/(하사자)/g, '$1 <span class="direction-icon">↘️</span>')
        .replace(/(상사자)/g, '$1 <span class="direction-icon">↗️</span>')
        .replace(/(횡자)/g, '$1 <span class="direction-icon">➡️</span>')
        .replace(/(직자)/g, '$1 <span class="direction-icon">⬇️</span>')
        .replace(/\(보\)/g, '(보) <span class="direction-icon">🔴↑</span>')
        .replace(/\(사\)/g, '(사) <span class="direction-icon">🔵↓</span>');
}

const acupointByName = new Map(acupointDictionary.map(p => [p.name, p]));

// 모든 혈자리 이름을 한 번에 찾는 정규식. 한 번만 훑기 때문에,
// 이미 삽입된 위치 설명 안의 혈자리 이름이 다시 변환되는 일이 없습니다.
const acupointRegex = new RegExp(
    acupointDictionary
        .map(p => p.name)
        .sort((a, b) => b.length - a.length)
        .map(escapeRegExp)
        .join('|'),
    'g'
);

function convertTextToAcupointLinks(text) {
    if (!text) return "";
    return text.replace(acupointRegex, (name, offset, whole) => {
        // "별곡지", "별소해"는 곡지·소해와 다른 혈자리이므로 변환하지 않습니다.
        if (offset > 0 && whole[offset - 1] === '별') return name;
        const point = acupointByName.get(name);
        return `
            <details class="acupoint-toggle">
                <summary>${point.name}</summary>
                <span class="acupoint-location"><b>[${point.code}]</b><br>${point.location}</span>
            </details>
        `;
    });
}

/* ---------- 주소(URL 해시) 연동 ---------- */
// 주소 형식: #cat=카테고리ID&item=항목이름&point=강조할 위치  또는  #q=검색어

const ROUTE_KEYS = ['cat', 'item', 'point', 'q'];

function readRoute() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const route = {};
    ROUTE_KEYS.forEach(key => { route[key] = params.get(key) || ''; });
    return route;
}

function buildHash(route) {
    const params = new URLSearchParams();
    ROUTE_KEYS.forEach(key => { if (route[key]) params.set(key, route[key]); });
    return '#' + params.toString();
}

let renderedHash = null;      // 마지막으로 화면에 그린 주소
let lastItemRoute = null;     // 검색 전에 보고 있던 항목
let wasSearching = false;

function navigate(route, replace) {
    const hash = buildHash(route);
    if (replace) {
        history.replaceState(null, '', hash);
    } else if (hash !== location.hash) {
        history.pushState(null, '', hash);
    }
    applyRoute(true);
}

function applyRoute(force) {
    if (!force && location.hash === renderedHash) return;
    renderedHash = location.hash;

    const route = readRoute();
    if (route.q.trim()) {
        showSearch(route.q);
    } else {
        showItem(route);
    }
}

/* ---------- 항목 화면 ---------- */

function showItem(route) {
    const cat = findCategory(route.cat) || appData.categories[0];
    const item = cat.items.find(i => i.name === route.item) || cat.items[0];

    lastItemRoute = { cat: cat.id, item: item ? item.name : '' };
    if (searchInput.value !== '') searchInput.value = '';

    searchResults.hidden = true;
    contentCard.hidden = false;

    document.querySelectorAll('.category-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.cat === cat.id);
    });

    subTabWrapper.innerHTML = '';
    cat.items.forEach(subItem => {
        const subBtn = document.createElement('button');
        subBtn.className = 'sub-tab-btn' + (subItem === item ? ' active' : '');
        subBtn.innerText = subItem.name;
        subBtn.onclick = () => navigate({ cat: cat.id, item: subItem.name });
        subTabWrapper.appendChild(subBtn);
    });

    if (!item) {
        contentCard.innerHTML = '';
        return;
    }

    renderContent(item, cat.id);

    if (route.point) {
        focusPoint(route.point);
    } else if (wasSearching) {
        window.scrollTo(0, 0);
    }
    wasSearching = false;
}

function focusPoint(elementId) {
    const target = document.getElementById(elementId);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.classList.add('flash');
    setTimeout(() => target.classList.remove('flash'), 1500);
}

function renderContent(item, catId) {
    const isDongssi = Boolean(item.is_dongssi_group);

    // 동씨기혈은 서브 탭을 숨기고 카드를 넓게 씁니다.
    subTabWrapper.hidden = isDongssi;
    contentCard.classList.toggle('dongssi-mode', isDongssi);

    if (isDongssi) {
        contentCard.innerHTML = renderDongssiGroup(item);
        return;
    }

    const imgSrc = item.이미지 ? item.이미지 : PLACEHOLDER_IMAGE;

    let leftSideHtml = `
        <div class="image-container">
            <img src="${escapeHtml(imgSrc)}" alt="${escapeHtml(item.name)} 안내도">
        </div>
    `;

    if (item.취혈위치) {
        leftSideHtml += `<div class="guide-box">📍 <b>취혈 가이드:</b><br>${item.취혈위치}</div>`;
    }

    let rightSideHtml = `<h1 class="disease-title">${item.name}</h1>`;

    if (catId === 'CAT_DIAGNOSIS') {
        rightSideHtml += renderDiagnosis(item);
    } else {
        rightSideHtml += renderTreatment(item);
    }

    if (item.dongssi_link) {
        const link = item.dongssi_link;
        rightSideHtml += `
            <div class="dongssi-link-box">
                <p>💡 해당 증상에 임상 효과가 뛰어난 동씨기혈 처방이 존재합니다.</p>
                <button class="action-btn"
                    data-target-cat="${escapeHtml(link.target_cat)}"
                    data-target-idx="${escapeHtml(link.target_idx)}"
                    data-target-point="${escapeHtml(link.target_anchor || '')}">
                    ${link.btn_label}
                </button>
            </div>
        `;
    }

    contentCard.innerHTML = `
        <div class="card-photo-side">${leftSideHtml}</div>
        <div class="card-content-side">${rightSideHtml}</div>
    `;
}

function renderDiagnosis(item) {
    let html = '';

    if (item.type === 'diagnostic_tip') {
        html += `<h3 class="section-title">⚡ 신경 지배 구역 가이드</h3><ul class="info-list">`;
        item.content.forEach(c => {
            html += `<li><b>${c.nerve}</b>: ${c.area}</li>`;
        });
        html += `</ul>`;
    } else if (item.type === 'exam_list') {
        item.exams.forEach((ex, index) => {
            // 연결된 치료법이 있는 검사에만 이동 버튼을 표시합니다.
            const hasTarget = ex.btn_label && ex.target_cat;
            const buttonHtml = hasTarget
                ? `<button class="action-btn"
                        data-target-cat="${escapeHtml(ex.target_cat)}"
                        data-target-idx="${escapeHtml(ex.target_idx)}">${ex.btn_label}</button>`
                : '';
            html += `
                <div class="exam-block" id="EXAM_${index}">
                    <h3 class="exam-title">📋 ${ex.exam_name}</h3>
                    <p class="exam-method"><b>검사 방법:</b> ${ex.method}</p>
                    <p class="exam-positive"><b>양성 반응 조건:</b> ${ex.positive}</p>
                    ${buttonHtml}
                </div>
            `;
        });
    }

    return html;
}

function renderTreatment(item) {
    let html = '';

    if (item.혈자리 && item.혈자리.length > 0) {
        html += `<h3 class="section-title">🔴 치료 혈자리</h3><div class="tag-container">`;
        item.혈자리.forEach(p => {
            html += `<span class="tag">${convertTextToAcupointLinks(p)}</span>`;
        });
        html += `</div>`;
    }

    if (item.구조물 && item.구조물.length > 0) {
        html += `<h3 class="section-title">Bone & Muscle 해부학 구조물</h3><div class="tag-container">`;
        item.구조물.forEach(s => {
            html += `<span class="tag structure">${s}</span>`;
        });
        html += `</div>`;
    }

    if (item.일반주치) {
        html += `<h3 class="section-title">💡 일반 주치</h3><p style="padding-left:5px;">${convertTextToAcupointLinks(item.일반주치)}</p>`;
    }
    if (item.특수주치) {
        html += `<h3 class="section-title">✨ 특수 주치</h3><p style="padding-left:5px; color:#27ae60; font-weight:bold;">${item.특수주치}</p>`;
    }
    if (item.임상팁) {
        html += `<h3 class="section-title">🔥 임상 실전 Tip</h3><p style="padding-left:5px; color:#e67e22;">${convertTextToAcupointLinks(item.임상팁)}</p>`;
    }

    if (item.자침법 && item.자침법.length > 0) {
        html += `<h3 class="section-title">💉 안전 자침 기술 가이드</h3><ul class="info-list">`;
        item.자침법.forEach(m => {
            html += `<li>${convertTextToAcupointLinks(parseDirectionIcons(m))}</li>`;
        });
        html += `</ul>`;
    }

    if (item.유의점 && item.유의점.length > 0) {
        html += `<div class="warning-box">⚠️ 유의사항:<br>${item.유의점.join('<br>')}</div>`;
    }

    if (item.기타 && item.기타.length > 0) {
        html += `<h3 class="section-title">📌 기타 참고사항</h3><ul class="info-list">`;
        item.기타.forEach(e => {
            html += `<li>${convertTextToAcupointLinks(e)}</li>`;
        });
        html += `</ul>`;
    }

    // 참고: data.js의 "시각_가이드"는 이미지 제작용 메모이므로 화면에 표시하지 않습니다.

    if (!html) {
        html = `<p class="empty-note">📝 내용 준비 중입니다.</p>`;
    }

    return html;
}

function renderDongssiGroup(item) {
    const dongssiItems = findCategory('CAT_DONGSSI').items;

    let html = `<div class="dongssi-nav">`;
    dongssiItems.forEach(dItem => {
        const activeClass = dItem === item ? ' active' : '';
        html += `<button class="dongssi-nav-btn${activeClass}" data-nav-item="${escapeHtml(dItem.name)}">${dItem.name.split(' ')[0]}</button>`;
    });
    html += `</div>`;

    html += `<h1 class="disease-title dongssi-title">☯️ 동씨기혈 : ${item.name}</h1>`;

    item.points.forEach(pt => {
        const imgHtml = pt.이미지
            ? `<img src="${escapeHtml(pt.이미지)}" alt="${escapeHtml(pt.name)}">`
            : `<div class="dongssi-no-image">이미지 없음</div>`;

        html += `
            <div id="${escapeHtml(pt.id_tag)}" class="dongssi-card-item">
                <div class="dongssi-card-photo">${imgHtml}</div>
                <div class="dongssi-card-body">
                    <h3>📍 ${pt.name}</h3>
                    <div class="dongssi-row"><strong>취혈 위치:</strong> ${pt.취혈위치}</div>
                    <div class="dongssi-row"><strong>주치 효과:</strong> ${convertTextToAcupointLinks(pt.일반주치)}</div>
                </div>
            </div>
        `;
    });

    return html;
}

// 카드 안의 이동 버튼 (치료법으로 이동, 동씨기혈 보러가기, 동씨기혈 내부 메뉴)
contentCard.addEventListener('click', event => {
    const navBtn = event.target.closest('[data-nav-item]');
    if (navBtn) {
        navigate({ cat: 'CAT_DONGSSI', item: navBtn.dataset.navItem });
        return;
    }

    const refBtn = event.target.closest('[data-target-cat]');
    if (refBtn) {
        const cat = findCategory(refBtn.dataset.targetCat);
        const item = cat && cat.items[Number(refBtn.dataset.targetIdx)];
        if (!item) return;
        navigate({ cat: cat.id, item: item.name, point: refBtn.dataset.targetPoint || '' });
    }
});

/* ---------- 검색 ---------- */

// 혈자리 이름 뒤에 코드를 붙여 "ST36" 같은 코드로도 찾을 수 있게 합니다.
function withCode(name) {
    const point = acupointByName.get(name);
    return point ? `${name}(${point.code})` : name;
}

function buildSearchIndex() {
    const entries = [];

    const addEntry = (cat, item, title, point, fields) => {
        const usable = fields.filter(f => f.text);
        const hay = [title, ...usable.map(f => f.text)].join('\n').toLowerCase();
        entries.push({
            path: title === item.name ? cat.category_name : `${cat.category_name} › ${item.name}`,
            title,
            hash: buildHash({ cat: cat.id, item: item.name, point }),
            fields: usable,
            titleLower: title.toLowerCase(),
            hay,
            hayCompact: hay.replace(/\s+/g, '')
        });
    };

    appData.categories.forEach(cat => {
        cat.items.forEach(item => {
            if (item.type === 'exam_list') {
                addEntry(cat, item, item.name, '', []);
                item.exams.forEach((ex, index) => {
                    addEntry(cat, item, ex.exam_name, `EXAM_${index}`, [
                        { label: '검사 방법', text: ex.method },
                        { label: '양성 반응', text: ex.positive }
                    ]);
                });
            } else if (item.type === 'diagnostic_tip') {
                addEntry(cat, item, item.name, '', item.content.map(c => (
                    { label: c.nerve, text: c.area }
                )));
            } else if (item.is_dongssi_group) {
                addEntry(cat, item, item.name, '', []);
                item.points.forEach(pt => {
                    addEntry(cat, item, pt.name, pt.id_tag, [
                        { label: '취혈 위치', text: pt.취혈위치 },
                        { label: '주치 효과', text: pt.일반주치 }
                    ]);
                });
            } else {
                const fields = [
                    { label: '혈자리', text: (item.혈자리 || []).map(withCode).join(', ') },
                    { label: '구조물', text: (item.구조물 || []).join(', ') }
                ];
                (item.자침법 || []).forEach(text => fields.push({ label: '자침법', text }));
                (item.유의점 || []).forEach(text => fields.push({ label: '유의사항', text }));
                (item.기타 || []).forEach(text => fields.push({ label: '참고', text }));
                addEntry(cat, item, item.name, '', fields);
            }
        });
    });

    return entries;
}

const searchIndex = buildSearchIndex();

function search(query) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return { terms, results: [] };
    const compact = terms.join('');

    const results = [];
    searchIndex.forEach(entry => {
        const allTerms = terms.every(t => entry.hay.includes(t));
        // "테니스엘보"처럼 띄어쓰기 없이 입력해도 찾을 수 있게 합니다.
        if (!allTerms && !entry.hayCompact.includes(compact)) return;

        const titleHits = terms.filter(t => entry.titleLower.includes(t)).length;
        const field = entry.fields.find(f => {
            const lower = f.text.toLowerCase();
            return terms.some(t => lower.includes(t));
        });
        results.push({ entry, field, score: titleHits });
    });

    // 제목에 검색어가 들어간 결과를 먼저 보여줍니다. (같은 점수는 원래 순서 유지)
    results.sort((a, b) => b.score - a.score);
    return { terms, results };
}

function highlight(text, terms) {
    const pattern = new RegExp('(' + terms.map(escapeRegExp).join('|') + ')', 'gi');
    return text.split(pattern)
        .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
        .join('');
}

function makeSnippet(text, terms) {
    const MAX = 90;
    if (text.length <= MAX) return text;
    const lower = text.toLowerCase();
    const firstHit = Math.min(...terms.map(t => lower.indexOf(t)).filter(i => i >= 0));
    const start = Math.max(0, firstHit - 30);
    return (start > 0 ? '…' : '') + text.slice(start, start + MAX) + (start + MAX < text.length ? '…' : '');
}

function showSearch(query) {
    if (searchInput.value !== query) searchInput.value = query;
    wasSearching = true;

    subTabWrapper.hidden = true;
    contentCard.hidden = true;
    searchResults.hidden = false;
    document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));

    const { terms, results } = search(query);

    let html = `<p class="search-summary">"${escapeHtml(query.trim())}" 검색 결과 ${results.length}건</p>`;
    if (results.length === 0) {
        html += `<p class="search-empty">검색 결과가 없습니다. 다른 검색어를 입력해 보세요.</p>`;
    }
    results.forEach(({ entry, field }) => {
        const snippetHtml = field
            ? `<span class="search-result-snippet">${escapeHtml(field.label)}: ${highlight(makeSnippet(field.text, terms), terms)}</span>`
            : '';
        html += `
            <a class="search-result" href="${entry.hash}">
                <span class="search-result-path">${escapeHtml(entry.path)}</span>
                <span class="search-result-title">${highlight(entry.title, terms)}</span>
                ${snippetHtml}
            </a>
        `;
    });

    searchResults.innerHTML = html;
}

searchInput.addEventListener('input', () => {
    const query = searchInput.value;
    const alreadySearching = Boolean(readRoute().q);

    if (query.trim()) {
        // 글자를 칠 때마다 뒤로가기 기록이 쌓이지 않도록, 검색 중에는 주소를 교체합니다.
        navigate({ q: query }, alreadySearching);
    } else if (alreadySearching) {
        navigate(lastItemRoute || {}, true);
    }
});

/* ---------- 시작 ---------- */

function initWebApps() {
    appData.categories.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'category-btn';
        btn.dataset.cat = cat.id;
        btn.innerText = cat.category_name;
        btn.onclick = () => navigate({ cat: cat.id });
        navHeader.appendChild(btn);
    });

    // 뒤로가기/앞으로가기, 주소 직접 수정, 검색 결과 링크 클릭에 반응합니다.
    window.addEventListener('hashchange', () => applyRoute(false));
    window.addEventListener('popstate', () => applyRoute(false));

    applyRoute(true);
}

initWebApps();
