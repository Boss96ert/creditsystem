// =====================================================
// CREDITSYSTEM
// Einstellungen
// =====================================================

const CONFIG = {

    // HIER SPÄTER DIE ID DEINER GOOGLE-TABELLE EINTRAGEN
    SHEET_ID: "1gBgckt8jRzHv_xN20TkOCXHA1Kt2McGiYqVvfju7meY",

    // Namen der Tabellenblätter
    PLAYERS_SHEET: "Spieler",
    JOBS_SHEET: "Einsaetze",

    // Saison
    SEASON: "2026/27",

    // Titel
    TITLE: "Creditsystem",

    // Webseite aktualisiert die Daten automatisch
    // alle 5 Minuten
    REFRESH_INTERVAL: 5 * 60 * 1000
};


// =====================================================
// Globale Variablen
// =====================================================

let players = [];
let assignments = [];

let teamChart = null;
let playerChart = null;


// =====================================================
// Start
// =====================================================

document.addEventListener("DOMContentLoaded", () => {

    document.title = CONFIG.TITLE;

    setupEvents();

    loadData();

    setInterval(loadData, CONFIG.REFRESH_INTERVAL);
});


// =====================================================
// Buttons / Suche
// =====================================================

function setupEvents() {

    const searchInput =
        document.getElementById("searchInput");

    if (searchInput) {

        searchInput.addEventListener(
            "input",
            () => {

                renderPlayers(
                    searchInput.value
                );

            }
        );
    }


    const backButton =
        document.getElementById("backButton");

    if (backButton) {

        backButton.addEventListener(
            "click",
            () => {

                showOverview();

            }
        );
    }
}


// =====================================================
// Google Sheets laden
// =====================================================

async function loadData() {

    showError("");

    try {

        if (
            !CONFIG.SHEET_ID ||
            CONFIG.SHEET_ID ===
            "DEINE_GOOGLE_SHEETS_ID"
        ) {

            throw new Error(
                "Die Google-Sheets-ID wurde noch nicht eingetragen."
            );
        }


        const playersUrl =
            createSheetUrl(
                CONFIG.PLAYERS_SHEET
            );

        const jobsUrl =
            createSheetUrl(
                CONFIG.JOBS_SHEET
            );


        const [
            playersResponse,
            jobsResponse
        ] = await Promise.all([

            fetch(playersUrl),

            fetch(jobsUrl)

        ]);


        if (!playersResponse.ok) {

            throw new Error(
                "Das Tabellenblatt 'Spieler' konnte nicht geladen werden."
            );

        }


        if (!jobsResponse.ok) {

            throw new Error(
                "Das Tabellenblatt 'Einsaetze' konnte nicht geladen werden."
            );

        }


        const playersCsv =
            await playersResponse.text();

        const jobsCsv =
            await jobsResponse.text();


        players =
            normalizePlayers(
                parseCSV(playersCsv)
            );


        assignments =
            normalizeAssignments(
                parseCSV(jobsCsv)
            );


        calculateCredits();


        renderOverview();


        // Falls URL bereits einen Spieler enthält
        showPlayerFromUrl();


    } catch (error) {

        console.error(error);

        showError(
            "Die Daten konnten nicht geladen werden.<br><br>" +
            error.message
        );

    }
}


// =====================================================
// Google-Sheets-URL
// =====================================================

function createSheetUrl(sheetName) {

    return (
        "https://docs.google.com/spreadsheets/d/" +
        CONFIG.SHEET_ID +
        "/gviz/tq?tqx=out:csv" +
        "&sheet=" +
        encodeURIComponent(sheetName) +
        "&_=" +
        Date.now()
    );
}


// =====================================================
// CSV Parser
// =====================================================

function parseCSV(csv) {

    const rows = [];

    let row = [];

    let value = "";

    let insideQuotes = false;


    for (let i = 0; i < csv.length; i++) {

        const char = csv[i];

        const next = csv[i + 1];


        if (char === '"' && insideQuotes && next === '"') {

            value += '"';

            i++;

            continue;
        }


        if (char === '"') {

            insideQuotes = !insideQuotes;

            continue;
        }


        if (char === "," && !insideQuotes) {

            row.push(value);

            value = "";

            continue;
        }


        if (
            (char === "\n" || char === "\r") &&
            !insideQuotes
        ) {

            if (char === "\r" && next === "\n") {

                i++;
            }


            row.push(value);

            value = "";


            if (
                row.some(
                    cell => cell.trim() !== ""
                )
            ) {

                rows.push(row);
            }


            row = [];

            continue;
        }


        value += char;
    }


    if (value !== "" || row.length > 0) {

        row.push(value);

        rows.push(row);
    }


    if (rows.length === 0) {

        return [];
    }


    const headers =
        rows[0].map(
            header =>
                header
                    .trim()
                    .replace(/^\uFEFF/, "")
        );


    return rows
        .slice(1)
        .map(row => {

            const object = {};

            headers.forEach(
                (header, index) => {

                    object[header] =
                        (row[index] || "").trim();

                }
            );

            return object;
        });
}


// =====================================================
// Spieler vorbereiten
// =====================================================

function normalizePlayers(data) {

    return data
        .filter(
            player =>
                player.ID &&
                player.Name
        )
        .map(player => {

            return {

                id:
                    String(
                        player.ID
                    ).trim(),

                name:
                    String(
                        player.Name
                    ).trim(),

                target:
                    Number(
                        String(
                            player.ZielCredits
                        )
                        .replace(",", ".")
                    ) || 0,

                active:
                    String(
                        player.Aktiv
                    )
                    .trim()
                    .toUpperCase() !== "NEIN",

                credits: 0,

                missing: 0,

                progress: 0

            };

        })
        .filter(
            player =>
                player.active
        );
}


// =====================================================
// Einsätze vorbereiten
// =====================================================

function normalizeAssignments(data) {

    return data
        .filter(
            assignment =>
                assignment.SpielerID
        )
        .map(assignment => {

            return {

                id:
                    String(
                        assignment.ID || ""
                    ).trim(),

                playerId:
                    String(
                        assignment.SpielerID
                    ).trim(),

                date:
                    String(
                        assignment.Datum || ""
                    ).trim(),

                job:
                    String(
                        assignment.Einsatz || ""
                    ).trim(),

                credits:
                    Number(
                        String(
                            assignment.Credits || "0"
                        )
                        .replace(",", ".")
                    ) || 0,

                note:
                    String(
                        assignment.Bemerkung || ""
                    ).trim()

            };

        });
}


// =====================================================
// Credits berechnen
// =====================================================

function calculateCredits() {

    players.forEach(player => {

        const playerAssignments =
            assignments.filter(
                assignment =>
                    assignment.playerId ===
                    player.id
            );


        player.credits =
            playerAssignments.reduce(
                (sum, assignment) =>
                    sum + assignment.credits,
                0
            );


        player.missing =
            Math.max(
                0,
                player.target -
                player.credits
            );


        if (player.target > 0) {

            player.progress =
                Math.min(
                    100,
                    Math.round(
                        (
                            player.credits /
                            player.target
                        ) * 100
                    )
                );

        } else {

            player.progress = 0;

        }

    });
}


// =====================================================
// Übersicht anzeigen
// =====================================================

function renderOverview() {

    updateStatistics();

    renderPlayers();

    renderTeamChart();

    showOverview();
}


// =====================================================
// Statistik
// =====================================================

function updateStatistics() {

    const playerCount =
        players.length;


    const totalCredits =
        players.reduce(
            (sum, player) =>
                sum + player.credits,
            0
        );


    const totalTarget =
        players.reduce(
            (sum, player) =>
                sum + player.target,
            0
        );


    const progress =
        totalTarget > 0
            ? Math.round(
                (
                    totalCredits /
                    totalTarget
                ) * 100
            )
            : 0;


    setText(
        "playerCount",
        playerCount
    );

    setText(
        "totalCredits",
        totalCredits
    );

    setText(
        "totalTarget",
        totalTarget
    );

    setText(
        "teamProgress",
        progress + "%"
    );
}


// =====================================================
// Spieler anzeigen
// =====================================================

function renderPlayers(search = "") {

    const container =
        document.getElementById(
            "playerList"
        );


    if (!container) return;


    const searchText =
        search
            .toLowerCase()
            .trim();


    const filteredPlayers =
        players.filter(
            player =>
                player.name
                    .toLowerCase()
                    .includes(searchText)
        );


    if (filteredPlayers.length === 0) {

        container.innerHTML = `
            <div class="loading">
                Kein Spieler gefunden.
            </div>
        `;

        return;
    }


    container.innerHTML =
        filteredPlayers
            .map(
                player =>
                    createPlayerCard(player)
            )
            .join("");


    container
        .querySelectorAll(
            ".player-card"
        )
        .forEach(card => {

            card.addEventListener(
                "click",
                () => {

                    const playerId =
                        card.dataset.playerId;

                    showPlayer(
                        playerId
                    );

                }
            );

        });
}


// =====================================================
// Spielerkarte
// =====================================================

function createPlayerCard(player) {

    const safeName =
        escapeHtml(
            player.name
        );


    return `
        <div
            class="player-card"
            data-player-id="${player.id}"
        >

            <div class="player-top">

                <div>

                    <div class="player-name">
                        ${safeName}
                    </div>

                    <div class="player-meta">
                        Ziel: ${player.target} Credits
                    </div>

                </div>


                <div class="player-credits">
                    ${player.credits} / ${player.target}
                </div>

            </div>


            <div class="progress-wrapper">

                <div class="progress-info">

                    <span>
                        Fortschritt
                    </span>

                    <span>
                        ${player.progress}%
                    </span>

                </div>


                <div class="progress-bar">

                    <div
                        class="progress-fill"
                        style="width: ${player.progress}%"
                    ></div>

                </div>

            </div>


            <div class="player-footer">

                <div class="missing">

                    ${
                        player.missing > 0
                            ? `Noch ${player.missing} Credits`
                            : `Ziel erreicht 🎉`
                    }

                </div>


                <button
                    class="details-button"
                    type="button"
                >
                    Details →
                </button>

            </div>

        </div>
    `;
}


// =====================================================
// Detailseite
// =====================================================

function showPlayer(playerId) {

    const player =
        players.find(
            player =>
                player.id ===
                String(playerId)
        );


    if (!player) return;


    const detailPage =
        document.getElementById(
            "detailPage"
        );


    const overviewPage =
        document.getElementById(
            "overviewPage"
        );


    const detail =
        document.getElementById(
            "playerDetail"
        );


    const playerAssignments =
        assignments
            .filter(
                assignment =>
                    assignment.playerId ===
                    player.id
            )
            .sort(
                (a, b) =>
                    parseDate(
                        b.date
                    ) -
                    parseDate(
                        a.date
                    )
            );


    detail.innerHTML = `

        <div class="detail-card">

            <div class="section-label">
                SPIELER
            </div>

            <h2 class="detail-name">
                ${escapeHtml(player.name)}
            </h2>


            <div class="detail-main">

                <div class="detail-stat">

                    <span>
                        Credits
                    </span>

                    <strong>
                        ${player.credits}
                    </strong>

                </div>


                <div class="detail-stat">

                    <span>
                        Ziel
                    </span>

                    <strong>
                        ${player.target}
                    </strong>

                </div>


                <div class="detail-stat">

                    <span>
                        Noch benötigt
                    </span>

                    <strong>
                        ${player.missing}
                    </strong>

                </div>

            </div>


            <div class="progress-wrapper">

                <div class="progress-info">

                    <span>
                        Fortschritt
                    </span>

                    <span>
                        ${player.progress}%
                    </span>

                </div>


                <div class="progress-bar">

                    <div
                        class="progress-fill"
                        style="width: ${player.progress}%"
                    ></div>

                </div>

            </div>


            <div class="assignments">

                <div class="section-label">
                    EINSÄTZE
                </div>

                <h3>
                    Meine Einsätze
                </h3>


                ${
                    playerAssignments.length > 0
                        ? playerAssignments
                            .map(
                                assignment =>
                                    createAssignment(
                                        assignment
                                    )
                            )
                            .join("")
                        : `
                            <div class="loading">
                                Noch keine Einsätze vorhanden.
                            </div>
                        `
                }

            </div>

        </div>

    `;


    overviewPage.classList.add(
        "hidden"
    );

    detailPage.classList.remove(
        "hidden"
    );


    window.history.pushState(
        {},
        "",
        "?spieler=" +
        encodeURIComponent(
            player.id
        )
    );


    renderPlayerChart(
        player
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =====================================================
// Einsatz anzeigen
// =====================================================

function createAssignment(
    assignment
) {

    return `

        <div class="assignment">

            <div>

                <div class="assignment-date">
                    ${escapeHtml(
                        assignment.date
                    )}
                </div>

                <div class="assignment-name">
                    ${escapeHtml(
                        assignment.job
                    )}
                </div>

                ${
                    assignment.note
                        ? `
                            <div class="assignment-note">
                                ${escapeHtml(
                                    assignment.note
                                )}
                            </div>
                        `
                        : ""
                }

            </div>


            <div class="assignment-credits">
                +${assignment.credits}
            </div>

        </div>

    `;
}


// =====================================================
// Team-Diagramm
// =====================================================

function renderTeamChart() {

    const canvas =
        document.getElementById(
            "teamChart"
        );


    if (!canvas) return;


    if (teamChart) {

        teamChart.destroy();

    }


    teamChart =
        new Chart(
            canvas,
            {

                type: "bar",

                data: {

                    labels:
                        players.map(
                            player =>
                                player.name
                        ),

                    datasets: [

                        {

                            label:
                                "Credits",

                            data:
                                players.map(
                                    player =>
                                        player.credits
                                )

                        },

                        {

                            label:
                                "Ziel",

                            data:
                                players.map(
                                    player =>
                                        player.target
                                )

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true

                        }

                    }

                }

            }
        );
}


// =====================================================
// Persönliches Diagramm
// =====================================================

function renderPlayerChart(
    player
) {

    const canvas =
        document.getElementById(
            "playerChart"
        );


    if (!canvas) return;


    if (playerChart) {

        playerChart.destroy();

    }


    const playerAssignments =
        assignments
            .filter(
                assignment =>
                    assignment.playerId ===
                    player.id
            )
            .sort(
                (a, b) =>
                    parseDate(a.date) -
                    parseDate(b.date)
            );


    let runningCredits = 0;


    const labels = [];

    const values = [];


    playerAssignments.forEach(
        assignment => {

            runningCredits +=
                assignment.credits;

            labels.push(
                assignment.date
            );

            values.push(
                runningCredits
            );

        }
    );


    if (labels.length === 0) {

        labels.push(
            "Start"
        );

        values.push(
            0
        );

    }


    playerChart =
        new Chart(
            canvas,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label:
                                "Credits",

                            data:
                                values,

                            tension:
                                0.3,

                            fill:
                                false

                        },

                        {

                            label:
                                "Ziel",

                            data:
                                labels.map(
                                    () =>
                                        player.target
                                ),

                            borderDash:
                                [5, 5],

                            pointRadius:
                                0

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    scales: {

                        y: {

                            beginAtZero:
                                true

                        }

                    },

                    plugins: {

                        legend: {

                            position:
                                "bottom"

                        }

                    }

                }

            }
        );
}


// =====================================================
// Übersicht anzeigen
// =====================================================

function showOverview() {

    const overviewPage =
        document.getElementById(
            "overviewPage"
        );


    const detailPage =
        document.getElementById(
            "detailPage"
        );


    overviewPage.classList.remove(
        "hidden"
    );

    detailPage.classList.add(
        "hidden"
    );


    window.history.pushState(
        {},
        "",
        window.location.pathname
    );


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });
}


// =====================================================
// Spieler anhand URL öffnen
// =====================================================

function showPlayerFromUrl() {

    const params =
        new URLSearchParams(
            window.location.search
        );


    const playerId =
        params.get(
            "spieler"
        );


    if (playerId) {

        showPlayer(
            playerId
        );

    }
}


// =====================================================
// Hilfsfunktionen
// =====================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {

        element.textContent =
            value;

    }
}


function showError(
    message
) {

    const box =
        document.getElementById(
            "errorBox"
        );


    if (!box) return;


    if (!message) {

        box.classList.add(
            "hidden"
        );

        box.innerHTML = "";

        return;
    }


    box.innerHTML =
        message;

    box.classList.remove(
        "hidden"
    );
}


function parseDate(
    dateString
) {

    if (!dateString) {

        return 0;
    }


    // Deutsches Format:
    // TT.MM.JJJJ

    const parts =
        dateString.split(".");


    if (parts.length === 3) {

        return new Date(
            Number(parts[2]),
            Number(parts[1]) - 1,
            Number(parts[0])
        ).getTime();

    }


    return new Date(
        dateString
    ).getTime();
}


function escapeHtml(
    text
) {

    return String(text)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}
