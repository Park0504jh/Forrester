
"use strict";

const STORAGE_KEY = "inmulrok-editor-v1";

const PAGE_NAMES = {
    profile: "인적 사항",
    appearance: "외형 기록",
    personality: "성격과 특징",
    story: "생애와 서사",
    relationships: "인물 관계"
};

const TYPE_NAMES = {
    paragraph: "줄글 및 설명",
    table: "행과 열이 있는 표",
    stats: "수치와 능력치 막대",
    keywords: "키워드 및 태그",
    image: "이미지와 설명",
    timeline: "날짜별 사건 기록"
};

const $ = (id) => document.getElementById(id);

const characterName = $("characterName");
const pageSelect = $("pageSelect");
const blockList = $("blockList");
const emptyState = $("emptyState");
const formPanel = $("blockFormPanel");
const blockForm = $("blockForm");
const typeFields = $("typeFields");
const saveStatus = $("saveStatus");

let database = loadDatabase();
let editingId = null;

function createId() {
    return crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function emptyDatabase() {
    return {
        version: 1,
        characters: [{
            id: createId(),
            name: "",
            pages: {
                profile: [],
                appearance: [],
                personality: [],
                story: [],
                relationships: []
            }
        }]
    };
}

function loadDatabase() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (!saved) return emptyDatabase();

        const parsed = JSON.parse(saved);

        if (!parsed || !Array.isArray(parsed.characters)) {
            throw new Error("올바르지 않은 데이터");
        }

        return parsed;
    } catch (error) {
        console.error(error);
        return emptyDatabase();
    }
}

function getCharacter() {
    if (!database.characters.length) {
        database.characters.push({
            id: createId(),
            name: "",
            pages: {}
        });
    }

    const character = database.characters[0];

    if (!character.pages) character.pages = {};

    Object.keys(PAGE_NAMES).forEach((page) => {
        if (!Array.isArray(character.pages[page])) {
            character.pages[page] = [];
        }
    });

    return character;
}

function getBlocks() {
    const character = getCharacter();
    return character.pages[pageSelect.value];
}

function setStatus(message) {
    saveStatus.textContent = message;
}

function saveLocal() {
    try {
        getCharacter().name = characterName.value.trim();

        localStorage.setItem(STORAGE_KEY, JSON.stringify(database));

        setStatus("이 브라우저에 저장했습니다.");
        return true;
    } catch (error) {
        console.error(error);
        setStatus("저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.");
        return false;
    }
}

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

function parseLines(value) {
    return String(value || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
}

function field(label, name, value = "", placeholder = "") {
    return `
        <div class="editor-field">
            <label for="${name}">${escapeHtml(label)}</label>
            <textarea id="${name}" data-field="${name}"
                placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
        </div>
    `;
}

function renderTypeFields(block = {}) {
    const type = $("blockType").value;
    const data = block.data || {};

    if (type === "paragraph") {
        typeFields.innerHTML = field(
            "본문",
            "body",
            data.body || "",
            "인물의 설정과 특징을 자유롭게 작성하세요."
        );
    }

    if (type === "table") {
        const rows = data.rows || [
            ["항목", "내용"],
            ["이름", ""],
            ["특징", ""]
        ];

        typeFields.innerHTML = field(
            "표 내용",
            "rows",
            rows.map((row) => row.join(" | ")).join("\n"),
            "항목 | 내용\n이름 | 예시\n특징 | 예시"
        ) + `
            <p class="editor-help">
                한 줄에 한 행씩 작성하고, 각 열은 | 기호로 구분하세요.
                예: 이름 | 홍길동
            </p>
        `;
    }

    if (type === "stats") {
        typeFields.innerHTML = field(
            "능력치",
            "stats",
            (data.stats || [
                { label: "힘", value: 70 },
                { label: "지능", value: 80 }
            ]).map((stat) => `${stat.label}: ${stat.value}`).join("\n"),
            "힘: 70\n지능: 80\n민첩: 60"
        ) + `
            <p class="editor-help">
                한 줄에 하나씩 작성하세요. 값은 0~100 사이로 표시됩니다.
            </p>
        `;
    }

    if (type === "keywords") {
        typeFields.innerHTML = field(
            "태그",
            "tags",
            (data.tags || []).join(", "),
            "신중함, 책임감, 관찰력"
        );
    }

    if (type === "image") {
        typeFields.innerHTML = `
            <div class="editor-field">
                <label for="imageFile">이미지 파일 선택</label>
                <input id="imageFile" type="file" accept="image/*">
                <p class="editor-help">
                    선택한 이미지는 이 브라우저에 저장됩니다.
                    온라인 공유를 위해서는 추후 이미지 저장소 연결이 필요합니다.
                </p>
            </div>
            ${field("이미지 주소 (선택 사항)", "imageUrl", data.url || "",
                "https://example.com/image.jpg")}
            ${field("이미지 설명", "caption", data.caption || "",
                "이미지에 대한 설명을 입력하세요.")}
        `;
    }

    if (type === "timeline") {
        typeFields.innerHTML = field(
            "사건 목록",
            "events",
            (data.events || []).map((event) =>
                `${event.date} | ${event.title} | ${event.description}`
            ).join("\n"),
            "2020-01-01 | 첫 만남 | 두 사람이 처음 만났다."
        ) + `
            <p class="editor-help">
                날짜 | 사건 제목 | 상세 설명 순서로 한 줄에 하나씩 입력하세요.
            </p>
        `;
    }
}

function parseTable(text) {
    return parseLines(text).map((line) =>
        line.split("|").map((cell) => cell.trim())
    );
}

function parseStats(text) {
    return parseLines(text).map((line) => {
        const index = line.lastIndexOf(":");
        if (index < 0) return null;

        const label = line.slice(0, index).trim();
        const raw = Number(line.slice(index + 1).trim());

        if (!label || !Number.isFinite(raw)) return null;

        return {
            label,
            value: Math.max(0, Math.min(100, raw))
        };
    }).filter(Boolean);
}

function parseTimeline(text) {
    return parseLines(text).map((line) => {
        const parts = line.split("|").map((part) => part.trim());

        return {
            date: parts[0] || "",
            title: parts[1] || "제목 없음",
            description: parts.slice(2).join(" | ")
        };
    });
}

function collectData() {
    const type = $("blockType").value;

    if (type === "paragraph") {
        return { body: $("body").value };
    }

    if (type === "table") {
        return { rows: parseTable($("rows").value) };
    }

    if (type === "stats") {
        return { stats: parseStats($("stats").value) };
    }

    if (type === "keywords") {
        return {
            tags: $("tags").value.split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
        };
    }

    if (type === "image") {
        return {
            url: $("imageUrl").value.trim(),
            caption: $("caption").value.trim()
        };
    }

    if (type === "timeline") {
        return { events: parseTimeline($("events").value) };
    }

    return {};
}

function renderContent(block) {
    const data = block.data || {};

    if (block.type === "paragraph") {
        return `<div>${escapeHtml(data.body || "").replace(/\n/g, "<br>")}</div>`;
    }

    if (block.type === "table") {
        const rows = data.rows || [];

        if (!rows.length) return "<p>표 내용이 없습니다.</p>";

        return `
            <table class="editor-table">
                ${rows.map((row, index) => `
                    <tr>
                        ${row.map((cell) => index === 0
                            ? `<th>${escapeHtml(cell)}</th>`
                            : `<td>${escapeHtml(cell)}</td>`
                        ).join("")}
                    </tr>
                `).join("")}
            </table>
        `;
    }

    if (block.type === "stats") {
        return (data.stats || []).map((stat) => `
            <div class="editor-stat">
                <div class="editor-stat-label">
                    <span>${escapeHtml(stat.label)}</span>
                    <span>${stat.value}/100</span>
                </div>
                <div class="editor-stat-track">
                    <div class="editor-stat-fill"
                         style="width:${stat.value}%"></div>
                </div>
            </div>
        `).join("");
    }

    if (block.type === "keywords") {
        return `
            <div class="editor-tags">
                ${(data.tags || []).map((tag) => `
                    <span class="editor-tag">${escapeHtml(tag)}</span>
                `).join("")}
            </div>
        `;
    }

    if (block.type === "image") {
        const url = data.url || "";

        // 임의의 외부 프로토콜은 이미지 주소로 사용하지 않습니다.
        const safeUrl = /^(https?:\/\/|assets\/)/i.test(url) ? url : "";

        return `
            ${safeUrl
                ? `<img src="${escapeHtml(safeUrl)}" alt="${escapeHtml(block.title)}">`
                : "<p>이미지를 등록하지 않았습니다.</p>"}
            <p>${escapeHtml(data.caption || "")}</p>
        `;
    }

    if (block.type === "timeline") {
        return (data.events || []).map((event) => `
            <article class="editor-event">
                <time>${escapeHtml(event.date)}</time>
                <h4>${escapeHtml(event.title)}</h4>
                <p>${escapeHtml(event.description)}</p>
            </article>
        `).join("");
    }

    return "";
}

function renderBlocks() {
    const blocks = getBlocks();

    blockList.innerHTML = "";
    emptyState.hidden = blocks.length > 0;

    blocks.forEach((block, index) => {
        const article = document.createElement("article");
        article.className = "editor-block";

        article.innerHTML = `
            <div class="editor-block-header">
                <div>
                    <h3>${escapeHtml(block.title)}</h3>
                    <span class="editor-block-type">
                        ${escapeHtml(TYPE_NAMES[block.type] || block.type)}
                    </span>
                </div>
                <div class="editor-block-controls">
                    <button type="button" data-action="up"
                        ${index === 0 ? "disabled" : ""}>↑</button>
                    <button type="button" data-action="down"
                        ${index === blocks.length - 1 ? "disabled" : ""}>↓</button>
                    <button type="button" data-action="edit">수정</button>
                    <button type="button" data-action="delete"
                        class="secondary-button">삭제</button>
                </div>
            </div>
            <div class="editor-block-content">
                ${renderContent(block)}
            </div>
        `;

        article.querySelectorAll("button").forEach((button) => {
            button.addEventListener("click", () => {
                const action = button.dataset.action;

                if (action === "edit") openForm(block.id);

                if (action === "delete") {
                    if (!confirm(`'${block.title}' 기록 칸을 삭제할까요?`)) return;

                    blocks.splice(index, 1);
                    saveLocal();
                    renderBlocks();
                }

                if (action === "up" && index > 0) {
                    [blocks[index - 1], blocks[index]] =
                        [blocks[index], blocks[index - 1]];
                    saveLocal();
                    renderBlocks();
                }

                if (action === "down" && index < blocks.length - 1) {
                    [blocks[index + 1], blocks[index]] =
                        [blocks[index], blocks[index + 1]];
                    saveLocal();
                    renderBlocks();
                }
            });
        });

        blockList.appendChild(article);
    });
}

function openForm(id = null) {
    editingId = id;
    const block = id ? getBlocks().find((item) => item.id === id) : null;

    $("formHeading").textContent = block ? "기록 칸 수정" : "기록 칸 추가";
    $("blockId").value = block?.id || "";
    $("blockTitle").value = block?.title || "";
    $("blockType").value = block?.type || "paragraph";

    renderTypeFields(block || {});
    formPanel.hidden = false;
    formPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

function closeForm() {
    formPanel.hidden = true;
    blockForm.reset();
    typeFields.innerHTML = "";
    editingId = null;
}

$("addBlockButton").addEventListener("click", () => openForm());
$("closeFormButton").addEventListener("click", closeForm);
$("cancelFormButton").addEventListener("click", closeForm);

$("blockType").addEventListener("change", () => renderTypeFields());

blockForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const title = $("blockTitle").value.trim();
    const type = $("blockType").value;

    if (!title) {
        alert("기록 칸 제목을 입력해 주세요.");
        return;
    }

    const data = collectData();

    if (type === "image") {
        const file = $("imageFile")?.files?.[0];

        if (file) {
            if (!file.type.startsWith("image/")) {
                alert("이미지 파일만 선택할 수 있습니다.");
                return;
            }

            if (file.size > 2 * 1024 * 1024) {
                alert("현재 로컬 이미지 등록은 파일당 2MB 이하로 제한합니다.");
                return;
            }

            data.url = await fileToDataUrl(file);
        }
    }

    const blocks = getBlocks();

    if (editingId) {
        const existing = blocks.find((item) => item.id === editingId);

        if (existing) {
            existing.title = title;
            existing.type = type;
            existing.data = data;
        }
    } else {
        blocks.push({
            id: createId(),
            title,
            type,
            data
        });
    }

    if (saveLocal()) {
        renderBlocks();
        closeForm();
    }
});

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}

$("saveButton").addEventListener("click", () => {
    if (saveLocal()) renderBlocks();
});

characterName.addEventListener("change", saveLocal);

pageSelect.addEventListener("change", () => {
    closeForm();
    renderBlocks();
});

$("exportButton").addEventListener("click", () => {
    getCharacter().name = characterName.value.trim();

    const blob = new Blob(
        [JSON.stringify(database, null, 2)],
        { type: "application/json" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "inmulrok-backup.json";
    link.click();

    URL.revokeObjectURL(url);
    setStatus("JSON 백업 파일을 만들었습니다.");
});

$("importButton").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
        const imported = JSON.parse(await file.text());

        if (!imported || !Array.isArray(imported.characters)) {
            throw new Error("백업 파일 형식이 올바르지 않습니다.");
        }

        if (!confirm("현재 편집 데이터를 가져온 백업으로 교체할까요?")) {
            event.target.value = "";
            return;
        }

        database = imported;
        getCharacter().name = getCharacter().name || "";

        characterName.value = getCharacter().name;
        saveLocal();
        renderBlocks();
        setStatus("백업 데이터를 복원했습니다.");
    } catch (error) {
        alert("복원에 실패했습니다: " + error.message);
    }

    event.target.value = "";
});

characterName.value = getCharacter().name || "";
renderBlocks();
