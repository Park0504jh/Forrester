
document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "inmulrok-story-page-v1";

    const page = document.querySelector(".story-page");
    const editButton = document.getElementById("edit-button");
    const saveButton = document.getElementById("save-button");
    const cancelButton = document.getElementById("cancel-button");
    const editStatus = document.getElementById("edit-status");

    const timelineList = document.getElementById("timeline-list");
    const secretList = document.getElementById("secret-list");

    const timelineAddArea = document.getElementById("timeline-add-area");
    const secretAddArea = document.getElementById("secret-add-area");
    const secretCodeArea = document.getElementById("secret-code-area");

    const addTimelineButton = document.getElementById("add-timeline-button");
    const addSecretButton = document.getElementById("add-secret-button");
    const setSecretCodeButton = document.getElementById("set-secret-code-button");

    const secretLockPanel = document.getElementById("secret-lock-panel");
    const secretContent = document.getElementById("secret-content");
    const secretUnlockForm = document.getElementById("secret-unlock-form");
    const secretAccessInput = document.getElementById("secret-access-input");
    const secretLockMessage = document.getElementById("secret-lock-message");

    if (
        !page ||
        !editButton ||
        !saveButton ||
        !cancelButton ||
        !editStatus ||
        !timelineList ||
        !secretList
    ) {
        console.error("생애와 서사 페이지의 필수 HTML 요소를 찾을 수 없습니다.");
        return;
    }

    let isEditing = false;
    let secretsUnlocked = false;
    let secretAccessCode = "";
    let originalState = null;

    /* ----------------------------------
       텍스트 처리
    ---------------------------------- */

    function getText(element) {
        return element ? element.innerText : "";
    }

    function setText(element, value) {
        if (element && typeof value === "string") {
            element.innerText = value;
        }
    }

    function getEditableFields() {
        const fields = {};

        page.querySelectorAll("[data-editable]").forEach(function (element) {
            if (
                element.closest(".timeline-entry") ||
                element.closest(".secret-card")
            ) {
                return;
            }

            fields[element.dataset.editable] = getText(element);
        });

        return fields;
    }

    /* ----------------------------------
       연표 및 비밀 데이터
    ---------------------------------- */

    function getTimelineData() {
        return Array.from(
            timelineList.querySelectorAll(".timeline-entry")
        ).map(function (entry) {
            return {
                date: getText(entry.querySelector(".timeline-date")),
                title: getText(entry.querySelector("h3")),
                description: getText(
                    entry.querySelector(".timeline-description")
                )
            };
        });
    }

    function getSecretData() {
        return Array.from(
            secretList.querySelectorAll(".secret-card")
        ).map(function (card) {
            return {
                title: getText(
                    card.querySelector(".secret-card-heading h3")
                ),
                description: getText(
                    card.querySelector(".secret-card-body")
                )
            };
        });
    }

    function captureState() {
        return {
            fields: getEditableFields(),
            timeline: getTimelineData(),
            secrets: getSecretData(),
            accessCode: secretAccessCode,
            secretsUnlocked: secretsUnlocked
        };
    }

    /* ----------------------------------
       연표 항목 생성
    ---------------------------------- */

    function createTimelineEntry(item) {
        const entry = document.createElement("article");
        entry.className = "timeline-entry";

        const marker = document.createElement("div");
        marker.className = "timeline-marker";
        marker.setAttribute("aria-hidden", "true");

        const card = document.createElement("div");
        card.className = "timeline-card";

        const date = document.createElement("p");
        date.className = "timeline-date";
        date.dataset.editable = "timeline-date";
        date.innerText = item.date || "연도 또는 날짜";

        const title = document.createElement("h3");
        title.dataset.editable = "timeline-title";
        title.innerText = item.title || "사건의 이름";

        const description = document.createElement("p");
        description.className = "timeline-description";
        description.dataset.editable = "timeline-description";
        description.dataset.multiline = "true";
        description.innerText =
            item.description || "사건의 내용을 기록하세요.";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "story-remove-button";
        removeButton.dataset.removeItem = "";
        removeButton.innerText = "기록 삭제";

        card.append(date, title, description, removeButton);
        entry.append(marker, card);

        return entry;
    }

    /* ----------------------------------
       비밀 항목 생성
    ---------------------------------- */

    function createSecretCard(item) {
        const card = document.createElement("article");
        card.className = "secret-card";

        const heading = document.createElement("div");
        heading.className = "secret-card-heading";

        const seal = document.createElement("span");
        seal.className = "secret-seal";
        seal.setAttribute("aria-hidden", "true");
        seal.innerText = "秘";

        const title = document.createElement("h3");
        title.dataset.editable = "secret-title";
        title.innerText = item.title || "숨겨진 기록";

        heading.append(seal, title);

        const description = document.createElement("div");
        description.className = "secret-card-body";
        description.dataset.editable = "secret-description";
        description.dataset.multiline = "true";
        description.innerText =
            item.description || "감춰진 진실을 기록하세요.";

        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "story-remove-button";
        removeButton.dataset.removeItem = "";
        removeButton.innerText = "기록 삭제";

        card.append(heading, description, removeButton);

        return card;
    }

    function renderTimeline(items) {
        timelineList.replaceChildren();

        items.forEach(function (item) {
            timelineList.appendChild(createTimelineEntry(item));
        });
    }

    function renderSecrets(items) {
        secretList.replaceChildren();

        items.forEach(function (item) {
            secretList.appendChild(createSecretCard(item));
        });
    }

    /* ----------------------------------
       상태 복원
    ---------------------------------- */

    function applyState(state) {
        if (!state || typeof state !== "object") {
            return;
        }

        if (state.fields && typeof state.fields === "object") {
            Object.keys(state.fields).forEach(function (key) {
                const elements = Array.from(
                    page.querySelectorAll("[data-editable]")
                );

                const element = elements.find(function (item) {
                    return (
                        item.dataset.editable === key &&
                        !item.closest(".timeline-entry") &&
                        !item.closest(".secret-card")
                    );
                });

                setText(element, state.fields[key]);
            });
        }

        if (Array.isArray(state.timeline)) {
            renderTimeline(state.timeline);
        }

        if (Array.isArray(state.secrets)) {
            renderSecrets(state.secrets);
        }

        if (typeof state.accessCode === "string") {
            secretAccessCode = state.accessCode;
        }

        if (typeof state.secretsUnlocked === "boolean") {
            secretsUnlocked = state.secretsUnlocked;
        }

        updateEditableState();
    }

    function loadSavedContent() {
        try {
            const savedContent = localStorage.getItem(STORAGE_KEY);

            if (!savedContent) {
                return;
            }

            const state = JSON.parse(savedContent);

            if (!state || typeof state !== "object") {
                throw new Error("저장된 데이터 형식이 올바르지 않습니다.");
            }

            applyState(state);

            // 페이지를 새로 열면 비밀은 다시 잠근다.
            secretsUnlocked = false;
        } catch (error) {
            console.error("생애와 서사 기록을 불러오지 못했습니다.", error);
            editStatus.innerText = "기록을 불러오지 못함";
        }
    }

    
async function loadServerState() {
    const response = await fetch("/api/records/story", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error("서버 기록 조회 실패: " + response.status);
    }

    return await response.json();
}

async function saveServerState(state) {
    const response = await fetch("/api/records/story", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: state
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

    return result;
}


    /* ----------------------------------
       편집 모드 화면 갱신
    ---------------------------------- */

    function updateEditableState() {
        page.querySelectorAll("[data-editable]").forEach(function (element) {
            element.contentEditable = isEditing ? "true" : "false";
            element.spellcheck = false;
        });

        page.querySelectorAll("[data-remove-item]").forEach(function (button) {
            button.hidden = !isEditing;
        });

        editButton.hidden = isEditing;
        saveButton.hidden = !isEditing;
        cancelButton.hidden = !isEditing;

        if (timelineAddArea) {
            timelineAddArea.hidden = !isEditing;
        }

        if (secretAddArea) {
            secretAddArea.hidden = !isEditing;
        }

        if (secretCodeArea) {
            secretCodeArea.hidden = !isEditing;
        }

        if (secretLockPanel && secretContent) {
            secretLockPanel.hidden = isEditing || secretsUnlocked;
            secretContent.hidden = !isEditing && !secretsUnlocked;
        }

        page.classList.toggle("is-editing", isEditing);

        if (isEditing) {
            editStatus.innerText = "편집 모드";
        } else {
            editStatus.innerText = "열람 모드";
        }
    }

    /* ----------------------------------
       편집 시작 / 저장 / 취소
    ---------------------------------- */

    function startEditing() {
        originalState = captureState();
        isEditing = true;

        updateEditableState();
    }

    
async function saveEditing() {
    const state = captureState();

    // 저장 후에는 비밀을 다시 잠근다.
    state.secretsUnlocked = false;

    saveButton.disabled = true;
    editStatus.innerText = "서버에 저장 중...";

    try {
        await saveServerState(state);

        // 서버 저장 성공 후 브라우저에도 백업한다.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        isEditing = false;
        secretsUnlocked = false;
        originalState = null;

        updateEditableState();
        editStatus.innerText = "서버 저장 완료";

        if (secretLockMessage) {
            secretLockMessage.innerText = "";
        }
    } catch (error) {
        console.error("생애와 서사 기록 저장 실패:", error);

        // 실패하면 편집 상태를 유지한다.
        isEditing = true;
        updateEditableState();
        editStatus.innerText = "저장 실패";

        window.alert(
            "서버 저장에 실패했습니다.\n" +
            error.message +
            "\n수정한 내용이 사라지지 않도록 페이지를 새로고침하지 마세요."
        );
    } finally {
        saveButton.disabled = false;
    }
}


    /* ----------------------------------
       새 기록 추가
    ---------------------------------- */

    function addTimelineEntry() {
        if (!isEditing) {
            return;
        }

        const entry = createTimelineEntry({
            date: "새 날짜",
            title: "새 사건",
            description: "사건의 내용을 입력하세요."
        });

        timelineList.appendChild(entry);
        updateEditableState();

        const title = entry.querySelector("h3");

        if (title) {
            title.focus();
        }
    }

    function addSecret() {
        if (!isEditing) {
            return;
        }

        const card = createSecretCard({
            title: "새로운 비밀",
            description: "감춰진 진실을 입력하세요."
        });

        secretList.appendChild(card);
        updateEditableState();

        const title = card.querySelector(".secret-card-heading h3");

        if (title) {
            title.focus();
        }
    }

    /* ----------------------------------
       비밀 열람 코드 설정
    ---------------------------------- */

    function setSecretCode() {
        if (!isEditing) {
            return;
        }

        const newCode = window.prompt(
            "새 열람 코드를 입력하세요.\n" +
            "기존 코드를 변경하려면 새 코드를 입력하세요."
        );

        if (newCode === null) {
            return;
        }

        if (newCode.trim() === "") {
            window.alert("열람 코드는 빈칸으로 설정할 수 없습니다.");
            return;
        }

        secretAccessCode = newCode;
        secretsUnlocked = true;

        if (secretLockMessage) {
            secretLockMessage.innerText =
                "열람 코드가 변경되었습니다. 저장 버튼을 눌러 확정하세요.";
        }

        updateEditableState();
    }

    /* ----------------------------------
       비밀 열람
    ---------------------------------- */

    if (secretUnlockForm) {
        secretUnlockForm.addEventListener("submit", function (event) {
            event.preventDefault();

            if (!secretAccessCode) {
                secretLockMessage.innerText =
                    "열람 코드가 설정되지 않았습니다. 편집 모드에서 코드를 설정하세요.";
                return;
            }

            if (secretAccessInput.value === secretAccessCode) {
                secretsUnlocked = true;
                secretAccessInput.value = "";
                secretLockMessage.innerText = "";

                updateEditableState();
            } else {
                secretLockMessage.innerText =
                    "열람 코드가 올바르지 않습니다.";
            }
        });
    }

    /* ----------------------------------
       이벤트 연결
    ---------------------------------- */

    editButton.addEventListener("click", startEditing);
    saveButton.addEventListener("click", saveEditing);
    cancelButton.addEventListener("click", cancelEditing);

    if (addTimelineButton) {
        addTimelineButton.addEventListener("click", addTimelineEntry);
    }

    if (addSecretButton) {
        addSecretButton.addEventListener("click", addSecret);
    }

    if (setSecretCodeButton) {
        setSecretCodeButton.addEventListener("click", setSecretCode);
    }

    page.addEventListener("click", function (event) {
        const removeButton = event.target.closest("[data-remove-item]");

        if (!removeButton || !isEditing) {
            return;
        }

        const item = removeButton.closest(
            ".timeline-entry, .secret-card"
        );

        if (!item) {
            return;
        }

        const itemName = item.classList.contains("timeline-entry")
            ? "이 사건 기록"
            : "이 비밀 기록";

        if (window.confirm(itemName + "을(를) 삭제할까요?")) {
            item.remove();
        }
    });

    /* ----------------------------------
       초기화
    ---------------------------------- */

    
async function initializeStory() {
    let serverResult = null;

    try {
        serverResult = await loadServerState();
    } catch (error) {
        console.error("서버 기록 불러오기 실패:", error);
    }

    if (serverResult && serverResult.content) {
        // 서버 기록을 우선 적용한다.
        applyState(serverResult.content);

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(serverResult.content)
            );
        } catch (error) {
            console.warn("브라우저 백업 저장 실패:", error);
        }
    } else {
        // 서버에 기록이 없거나 연결할 수 없으면 기존 기록을 사용한다.
        loadSavedContent();
    }

    // 페이지를 다시 열었을 때 비밀은 항상 잠긴 상태로 시작한다.
    secretsUnlocked = false;
    isEditing = false;

    updateEditableState();
}

initializeStory();

});
