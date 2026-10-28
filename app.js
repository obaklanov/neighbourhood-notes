'use strict';

// 1. Interests and application state
const interests = [
    'Food',
    'Cafés',
    'Parks',
    'Architecture',
    'Culture',
    'Creative',
    'Social',
    'Waterfront'
];
let data = [];
let selected = new Set();
let saved = new Set();
let onlySaved = false;

// Restore favourites saved in this browser, if storage is available.
try {
    saved = new Set(JSON.parse(localStorage.getItem('nn-saved') || '[]'));
} catch {
    // Keep the empty set if storage is unavailable or unreadable.
}

// 2. Page elements and small helpers
// $(selector) is a shorthand for document.querySelector(selector).
const $ = selector => document.querySelector(selector);
const cards = $('#cards');
const dialog = $('#detail');

function notify(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(notify.timer);
    notify.timer = setTimeout(() => {
        $('#toast').classList.remove('show');
    }, 2400);
}

// Escape special characters before inserting photo metadata into HTML.
function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[char]));
}

function selectionLabel(neighbourhood, detailed = false) {
    const selection = neighbourhood.selection;
    if (selection.method === 'population') {
        return (selection.populationKind === 'census-count' ? '' : '≈ ') + Math.round(selection.population).toLocaleString() + ' residents · population rank #' + selection.rank + ' · ' + selection.referenceYear;
    }
    return selection.listingCount.toLocaleString() + ' listings · #' + selection.rank + ' in its city source' + (detailed ? ' · data date ' + escapeHtml(selection.snapshotDate) : '');
}

function photoCredit(neighbourhood) {
    const photo = neighbourhood.photo;
    return `
        <a href="${escapeHtml(photo.source)}"
           target="_blank" rel="noopener noreferrer">
            ${photo.kind === 'map' ? 'Map' : 'Photo'}: ${escapeHtml(photo.author)}
        </a>
        ·
        <a href="${escapeHtml(photo.licenseUrl)}"
           target="_blank" rel="noopener noreferrer">
            ${escapeHtml(photo.license)}
        </a>
        · cropped to fit
    `;
}

// Return the neighbourhood tags that match the selected interests.
// Search accepts accented and unaccented names, such as Medellín / Medellin.
function searchText(value) {
    return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
}

function filteredNeighbourhoods() {
    const query = searchText($('#search').value.trim());
    const city = $('#city').value;
    return data.filter(neighbourhood => {
        const passesCity = !city || neighbourhood.city === city;
        const passesSaved = !onlySaved || saved.has(neighbourhood.id);
        const text = searchText([
            neighbourhood.name, neighbourhood.city, neighbourhood.country,
            neighbourhood.area, neighbourhood.description, ...neighbourhood.tags
        ].join(' '));
        return passesCity && passesSaved && (!query || text.includes(query));
    });
}

function travelContext(neighbourhood) {
    if (neighbourhood.context !== 'cultural') return '';
    return `<p class="travel-context">Cultural profile · Canada advises against all travel to Ukraine.
        Images may predate damage. <a href="https://travel.gc.ca/destinations/ukraine"
        target="_blank" rel="noopener noreferrer">Read current travel advice ↗</a></p>`;
}

function matches(neighbourhood) {
    return neighbourhood.tags.filter(tag => selected.has(tag));
}

// 3. Filter, sort and render the neighbourhood cards
function render() {
    let list = filteredNeighbourhoods();

    list.sort((a, b) => {
        if ($('#sort').value === 'name') {
            return a.name.localeCompare(b.name);
        }
        // More matching interests come first. Ties keep the collection order.
        return matches(b).length - matches(a).length
            || data.indexOf(a) - data.indexOf(b);
    });

    $('#resultCount').textContent =
        `${list.length} neighbourhood${list.length === 1 ? '' : 's'}`
        + `${onlySaved ? ' in your saved collection' : ''}`
        + `${selected.size ? ' · ranked by your interests' : ' · selected by listings or population'}`;
    $('#cityContext').hidden = !list.some(neighbourhood => neighbourhood.context === 'cultural');
    $('#savedCount').textContent = saved.size;
    $('#empty').hidden = list.length > 0;
    cards.replaceChildren();

    for (const neighbourhood of list) {
        const article = document.createElement('article');
        article.className = 'card';
        article.style.setProperty('--card-color', neighbourhood.color);

        // This template supplies the HTML inside one card.
        article.innerHTML = `
            <div class="art">
                <span class="number">
                    ${escapeHtml(neighbourhood.city.toUpperCase())} / ${String(data.indexOf(neighbourhood) + 1).padStart(2, '0')}
                </span>
                <img class="neighbourhood-photo"
                     src="${neighbourhood.photo.src}"
                     alt="${escapeHtml(neighbourhood.photo.alt)}"
                     width="1000" height="600"
                     loading="lazy" decoding="async">
                <button class="save"
                        aria-label="${saved.has(neighbourhood.id) ? 'Unsave' : 'Save'} ${escapeHtml(neighbourhood.name)}"
                        aria-pressed="${saved.has(neighbourhood.id)}">
                    ${saved.has(neighbourhood.id) ? '♥' : '♡'}
                </button>
            </div>
            <div class="card-body">
                <div class="photo-credit">${photoCredit(neighbourhood)}</div>
                <span class="area">${escapeHtml(neighbourhood.city)} · ${escapeHtml(neighbourhood.country)}</span>
                <h3>${escapeHtml(neighbourhood.name)}</h3>
                <p class="local-area">${escapeHtml(neighbourhood.area)}</p>
                <p class="headline">${escapeHtml(neighbourhood.headline)}</p>
                <p class="listing-stat">${selectionLabel(neighbourhood)}</p>
                ${neighbourhood.photo.note ? `<p class="archive-label">${escapeHtml(neighbourhood.photo.note)}</p>` : ''}
                ${['population-data-only', 'data-only'].includes(neighbourhood.profileStatus) ? '<span class="context-label">Data profile · interests pending</span>' : ''}${neighbourhood.context === 'cultural' ? '<span class="context-label">Cultural profile</span>' : ''}
                <div class="tags">
                    ${neighbourhood.tags.map(tag => `
                        <span class="tag ${selected.has(tag) ? 'matched' : ''}">${tag}</span>
                    `).join('')}
                </div>
                <div class="card-bottom">
                    <button class="detail-button">Get to know it ↗</button>
                    <span class="match">
                        ${selected.size
                            ? `${matches(neighbourhood).length} of ${selected.size} interests`
                            : neighbourhood.profileStatus === 'data-only' ? 'Explore the area' : 'Explore the character'}
                    </span>
                </div>
            </div>
        `;

        article.querySelector('.save').onclick = () => {
            if (saved.has(neighbourhood.id)) {
                saved.delete(neighbourhood.id);
            } else {
                saved.add(neighbourhood.id);
            }
            try {
                localStorage.setItem('nn-saved', JSON.stringify([...saved]));
            } catch {
                notify('Saving is available for this visit only.');
            }
            render();
        };

        article.querySelector('.detail-button').onclick = () => {
            openDetail(neighbourhood);
        };
        cards.append(article);
    }
}

// 4. Open an expanded neighbourhood profile
function openDetail(neighbourhood) {
    $('#detailContent').innerHTML = `
        <div class="eyebrow">${escapeHtml(neighbourhood.city.toUpperCase())} / ${escapeHtml(neighbourhood.country.toUpperCase())}</div>
        <h2>${escapeHtml(neighbourhood.name)}</h2>
        <p class="local-area">${escapeHtml(neighbourhood.area)}</p>
        ${travelContext(neighbourhood)}
        <figure class="detail-photo">
            <img src="${neighbourhood.photo.src}"
                 alt="${escapeHtml(neighbourhood.photo.alt)}"
                 width="1000" height="600">
            <figcaption class="photo-credit">${photoCredit(neighbourhood)}${neighbourhood.photo.note ? ` · ${escapeHtml(neighbourhood.photo.note)}` : ''}</figcaption>
        </figure>
        <p><em>${escapeHtml(neighbourhood.headline)}</em></p>
        <p class="listing-stat">${selectionLabel(neighbourhood, true)}</p>
        <p>${escapeHtml(neighbourhood.description)}</p>
        <div class="tags">
            ${neighbourhood.tags.map(tag => `
                <span class="tag">${tag}</span>
            `).join('')}
        </div>
        <h4>${neighbourhood.profileStatus === 'data-only' ? 'Explore the data' : neighbourhood.context === 'cultural' ? 'Discover its character' : 'A few ways to begin'}</h4>
        <ul>
            ${neighbourhood.highlights.map(highlight => `
                <li>${escapeHtml(highlight)}</li>
            `).join('')}
        </ul>
        <h4>The detail that matters</h4>
        <p class="note">${escapeHtml(neighbourhood.nuance)}</p>
        <div class="detail-links">
            <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(neighbourhood.name + ', ' + (neighbourhood.selection.municipality || neighbourhood.city) + ', ' + neighbourhood.country)}"
               target="_blank" rel="noopener noreferrer">
                Explore on a map ↗
            </a>
            <a href="${neighbourhood.source}"
               target="_blank" rel="noopener noreferrer">
                Read the source ↗
            </a>
        </div>
        <p class="source-note">
            Selection: <a href="${neighbourhood.selection.source}" target="_blank" rel="noopener noreferrer">${escapeHtml(neighbourhood.selection.publisher)}</a>, <a href="${neighbourhood.selection.licenseUrl}" target="_blank" rel="noopener noreferrer">${escapeHtml(neighbourhood.selection.license)}</a>. Neither listing count nor population is a quality rating or proof of availability.<br>
            ${escapeHtml(neighbourhood.selection.coverage)}.<br>
            ${escapeHtml(neighbourhood.selection.metric)}.<br>
            ${neighbourhood.selection.exclusionsNote ? escapeHtml(neighbourhood.selection.exclusionsNote) + '<br>' : ''}
            ${['population-data-only', 'data-only'].includes(neighbourhood.profileStatus) ? 'Data profile · interests not yet researched' : 'Editorial profile'} · source reviewed ${escapeHtml(neighbourhood.reviewedAt)}.
            Check current details before making plans.
        </p>
    `;
    dialog.showModal();
    history.replaceState(null, '', '#' + neighbourhood.id);
}

// 5. Reset controls and create the interest buttons
function reset() {
    selected.clear();
    $('#search').value = '';
    $('#sort').value = 'match';
    $('#city').value = '';

    onlySaved = false;
    $('#savedToggle').setAttribute('aria-pressed', 'false');
    document.querySelectorAll('.chip').forEach(button => {
        button.setAttribute('aria-pressed', 'false');
    });
    render();
}

for (const interest of interests) {
    const button = document.createElement('button');
    button.className = 'chip';
    button.textContent = interest;
    button.setAttribute('aria-pressed', 'false');

    button.onclick = () => {
        if (selected.has(interest)) {
            selected.delete(interest);
        } else if (selected.size < 5) {
            selected.add(interest);
        } else {
            notify('Choose up to five interests. Deselect one to try another.');
            return;
        }
        button.setAttribute('aria-pressed', String(selected.has(interest)));
        render();
    };
    $('#chips').append(button);
}

// 6. Connect page controls to their actions
$('#search').addEventListener('input', render);
$('#sort').addEventListener('change', render);
$('#city').addEventListener('change', render);
$('#reset').onclick = reset;
$('#emptyReset').onclick = reset;

$('#savedToggle').onclick = () => {
    onlySaved = !onlySaved;
    $('#savedToggle').setAttribute('aria-pressed', String(onlySaved));
    render();
    $('#explore').scrollIntoView();
};

$('#closeDetail').onclick = () => dialog.close();

// Close when someone clicks the backdrop outside the dialog rectangle.
dialog.addEventListener('click', event => {
    if (event.target === dialog) {
        const bounds = dialog.getBoundingClientRect();
        if (
            event.clientX < bounds.left
            || event.clientX > bounds.right
            || event.clientY < bounds.top
            || event.clientY > bounds.bottom
        ) {
            dialog.close();
        }
    }
});

dialog.addEventListener('close', () => {
    history.replaceState(null, '', '#explore');
});

$('#surprise').onclick = () => {
    const available = filteredNeighbourhoods();
    const pool = selected.size
        ? available.filter(neighbourhood => matches(neighbourhood).length)
        : available;
    if (pool.length) {
        const randomIndex = Math.floor(Math.random() * pool.length);
        openDetail(pool[randomIndex]);
    }
};

// 7. Load the data, validate it, then draw the initial collection
fetch('neighbourhoods.json?v=usa-1')
    .then(response => {
        if (!response.ok) {
            throw Error('Unable to load');
        }
        return response.json();
    })
    .then(rows => {
        if (
            !Array.isArray(rows)
            || rows.length === 0
            || rows.some(neighbourhood => (
                !neighbourhood.id
                || !neighbourhood.name
                || !neighbourhood.city
                || !neighbourhood.country
                || !neighbourhood.photo?.src
                || !Array.isArray(neighbourhood.tags)
            ))
        ) {
            throw Error('Invalid collection');
        }
        data = rows;

        // Generate the city selector from the records rather than a fixed list.
        const cities = [...new Set(data.map(neighbourhood => neighbourhood.city))].sort();
        for (const city of cities) {
            const option = document.createElement('option');
            option.value = city;
            option.textContent = city;
            $('#city').append(option);
        }
        $('#collectionSummary').textContent =
            `NORTH AMERICA · ${data.length} AREAS · ${cities.length} CITIES`;

        // Keep only saved IDs that still exist in the loaded collection.
        saved = new Set([...saved].filter(id => (
            data.some(neighbourhood => neighbourhood.id === id)
        )));
        render();

        // A URL such as #riverside opens that profile immediately.
        const entry = data.find(neighbourhood => (
            neighbourhood.id === location.hash.slice(1)
        ));
        if (entry) {
            openDetail(entry);
        }
    })
    .catch(() => {
        $('#resultCount').textContent =
            'The collection could not load. Please refresh to try again.';
    });
