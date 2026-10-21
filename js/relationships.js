
document.addEventListener("DOMContentLoaded", async function () {
    const STORAGE_KEY = "inmulrok-relationships-page-v1";
    const page = document.querySelector(".relationships-main");
    const lockSection = document.querySelector(".relationships-lock");

    if (!page || !lockSection) {
        console.error("인물관계 페이지 요소를 찾을 수 없습니다.");
        return;
    }

    let relationships = [];
    let originalRelationships = [];
    let isEditing = false;

    const toolbar = document.createElement("section");
    toolbar.className = "relationships-admin-toolbar";
    toolbar.innerHTML = `
        <p id="relationships-status">기록을 불러오는 중...</p>
        <div class="relationships-admin-actions">
            <button type="button" id="relationships-edit">기록 편집</button>
            <button type="button" id="relationships-save" hidden>저장</button>
            <button type="button" id="relationships-cancel" hidden>취소</button>
        </div>
    `;

    const editor = document.createElement("section");
    editor.className = "relationships-admin-editor";
    editor.hidden = true;

    lockSection.insertAdjacentElement("afterend", toolbar);
    toolbar.insertAdjacentElement("afterend", editor);

    const status = toolbar.querySelector("#relationships-status");
    const editButton = toolbar.querySelector("#relationships-edit");
    const saveButton = toolbar.querySelector("#relationships-save");
    const cancelButton = toolbar.querySelector("#relationships-cancel");

    function makeId() {
        return "relation-" + Date.now() + "-" +
            Math.random().toString(36).slice(2, 8);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function normalize(items) {
        if (!Array.isArray(items)) return [];

        return items.map(function (item) {
            return {
                id: String(item.id || makeId()),
                personA: String(item.personA || ""),
                personB: String(item.personB || ""),
                relation: String(item.relation || ""),
                description: String(item.description || "")
            };
        });
    }

    function renderEditor() {
        editor.innerHTML = "";

        relationships.forEach(function (item) {
            const card = document.createElement("article");
            card.className = "relationship-card";

            card.innerHTML = `
                <h3>인연 기록</h3>

                <label>
                    인물 A
                    <input data-field="personA"
                        value="${escapeHTML(item.personA)}"
                        placeholder="첫 번째 인물 이름">
                </label>

                <label>
                    인물 B
                    <input data-field="personB"
                        value="${escapeHTML(item.personB)}"
                        placeholder="두 번째 인물 이름">
                </label>

                <label>
                    관계 유형
                    <input data-field="relation"
                        value="${escapeHTML(item.relation)}"
                        placeholder="예: 친구, 가족, 숙적">
                </label>

                <label>
                    상세 기록
                    <textarea data-field="description" rows="5"
                        placeholder="두 인물의 관계와 사건을 기록하세요.">${escapeHTML(item.description)}</textarea>
                </label>

                <button type="button" data-remove="${escapeHTML(item.id)}">
                    이 기록 삭제
                </button>
            `;

            card.dataset.id = item.id;
            editor.appendChild(card);
        });

        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.textContent = "+ 인물관계 추가";
        addButton.addEventListener("click", function () {
            collectInputs();
            relationships.push({
                id: makeId(),
                personA: "",
                personB: "",
                relation: "",
                description: ""
            });
            renderEditor();
        });

        editor.appendChild(addButton);
    }

    function collectInputs() {
        editor.querySelectorAll(".relationship-card").forEach(function (card) {
            const item = relationships.find(function (entry) {
                return entry.id === card.dataset.id;
            });

            if (!item) return;

            card.querySelectorAll("[data-field]").forEach(function (field) {
                item[field.dataset.field] = field.value;
            });
        });
    }

    function renderReadOnly() {
        const display = document.createElement("section");
        display.className = "relationships-admin-display";

        if (relationships.length === 0) {
            display.innerHTML = "<p>아직 기록된 인연이 없습니다.</p>";
        } else {
            relationships.forEach(function (item) {
                const card = document.createElement("article");
                card.className = "relationship-card";

                const heading = document.createElement("h3");
                heading.textContent =
                    (item.personA || "이름 미입력") + " ↔ " +
                    (item.personB || "이름 미입력");

                const relation = document.createElement("p");
                relation.textContent = item.relation || "관계 미분류";

                const description = document.createElement("p");
                description.textContent =
                    item.description || "아직 상세 기록이 없습니다.";

                card.append(heading, relation, description);
                display.appendChild(card);
            });
        }

        const previous = page.querySelector(".relationships-admin-display");
        if (previous) previous.remove();

        page.appendChild(display);
    }

    async function loadServerState() {
        const response = await fetch("/api/records/relationships", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("서버 조회 실패: " + response.status);
        }

        return response.json();
    }

    async function saveServerState() {
        const response = await fetch("/api/records/relationships", {
            method: "PUT",
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: {
                    version: 1,
                    relationships: relationships
                }
            })
        });

        const result = await response.json().catch(function () {
            return {};
        });

        if (!response.ok) {
            throw new Error(
                result.message || "서버 저장 실패: " + response.status
            );
        }
    }

    function setEditing(value) {
        isEditing = value;
        editor.hidden = !value;
        saveButton.hidden = !value;
        cancelButton.hidden = !value;
        editButton.hidden = value;
        lockSection.hidden = value;

        if (value) {
            renderEditor();
            status.textContent = "편집 중입니다.";
        } else {
            renderReadOnly();
        }
    }

    editButton.addEventListener("click", function () {
        originalRelationships = JSON.parse(JSON.stringify(relationships));
        setEditing(true);
    });

    cancelButton.addEventListener("click", function () {
        relationships = JSON.parse(JSON.stringify(originalRelationships));
        setEditing(false);
        status.textContent = "변경 사항을 취소했습니다.";
    });

    saveButton.addEventListener("click", async function () {
        collectInputs();
        saveButton.disabled = true;
        cancelButton.disabled = true;
        status.textContent = "서버에 저장 중...";

        try {
            await saveServerState();

            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify({ relationships: relationships })
            );

            originalRelationships = JSON.parse(JSON.stringify(relationships));
            setEditing(false);
            status.textContent = "서버 저장 완료";
        } catch (error) {
            console.error(error);
            status.textContent = "저장 실패";
            alert("저장에 실패했습니다.\n" + error.message);
        } finally {
            saveButton.disabled = false;
            cancelButton.disabled = false;
        }
    });

    editor.addEventListener("input", function (event) {
        const card = event.target.closest(".relationship-card");
        if (!card || !event.target.dataset.field) return;

        const item = relationships.find(function (entry) {
            return entry.id === card.dataset.id;
        });

        if (item) item[event.target.dataset.field] = event.target.value;
    });

    editor.addEventListener("click", function (event) {
        const button = event.target.closest("[data-remove]");
        if (!button) return;

        if (!confirm("이 관계 기록을 삭제할까요?")) return;

        collectInputs();
        relationships = relationships.filter(function (item) {
            return item.id !== button.dataset.remove;
        });
        renderEditor();
    });

    try {
        const result = await loadServerState();

        if (result.content &&
            Array.isArray(result.content.relationships)) {
            relationships = normalize(result.content.relationships);
        } else {
            const local = localStorage.getItem(STORAGE_KEY);
            if (local) {
                relationships = normalize(JSON.parse(local).relationships);
            }
        }

        status.textContent = "기록을 불러왔습니다.";
    } catch (error) {
        console.error(error);
        status.textContent = "서버 기록을 불러오지 못했습니다.";
    }

    renderReadOnly();

    // 관리자 로그인 상태에서만 편집 도구를 표시합니다.
    try {
        const response = await fetch("/api/auth/status", {
            credentials: "same-origin",
            cache: "no-store"
        });

        const auth = response.ok ? await response.json() : { loggedIn: false };

        if (auth.loggedIn !== true) {
            toolbar.hidden = true;
            editor.hidden = true;
        }
    } catch (error) {
        toolbar.hidden = true;
        editor.hidden = true;
    }
});
