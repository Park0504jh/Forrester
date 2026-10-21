
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

    
async function startEditing() {
    editButton.disabled = true;
    editStatus.innerText = "기록을 불러오는 중...";

    try {
        const response = await fetch("/api/story/secrets", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("관리자 비밀 기록을 불러오지 못했습니다.");
        }

        const result = await response.json();

        renderSecrets(
            Array.isArray(result.secrets) ? result.secrets : []
        );

        originalState = captureState();
        isEditing = true;
        secretsUnlocked = true;

        updateEditableState();
    } catch (error) {
        console.error("편집 시작 실패:", error);
        editStatus.innerText = "기록을 불러오지 못했습니다.";

        window.alert(
            "편집을 시작할 수 없습니다.\n" + error.message
        );
    } finally {
        editButton.disabled = false;
    }
}


function cancelEditing() {
    if (originalState) {
        applyState(originalState);
    }

    isEditing = false;
    secretsUnlocked = false;
    originalState = null;

    updateEditableState();

    if (secretLockMessage) {
        secretLockMessage.innerText = "";
    }
}


    

async function saveEditing() {
    const state = captureState();

    // 열람 상태는 저장하지 않는다.
    state.secretsUnlocked = false;

    saveButton.disabled = true;
    editStatus.innerText = "서버에 저장 중...";

    try {
        await saveServerState(state);

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
    const newCode = window.prompt(
        "새 비밀 기록 열람 코드를 입력해 주세요.\n" +
        "한글이나 특수문자를 포함할 수 있으며, UTF-8 기준 72바이트 이하여야 합니다."
    );

    // 취소를 누르면 기존 설정을 유지한다.
    if (newCode === null) return;

    if (
        newCode.trim() === "" ||
        new TextEncoder().encode(newCode).length > 72
    ) {
        window.alert(
            "열람 코드는 비어 있을 수 없으며 72바이트 이하여야 합니다."
        );
        return;
    }

    secretAccessCode = newCode;

    if (secretLockMessage) {
        secretLockMessage.innerText =
            "새 열람 코드는 기록을 저장할 때 적용됩니다.";
    }

    secretsUnlocked = true;
    updateEditableState();
}

    /* ----------------------------------
       비밀 열람
    ---------------------------------- */

    
if (secretUnlockForm) {
    secretUnlockForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        const code = secretAccessInput.value;

        if (!code) {
            secretLockMessage.innerText = "열람 코드를 입력해 주세요.";
            return;
        }

        secretAccessInput.value = "";
        secretLockMessage.innerText = "열람 코드를 확인하고 있습니다.";

        try {
            const response = await fetch("/api/story/unlock", {
                method: "POST",
                credentials: "same-origin",
                cache: "no-store",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ code })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || "열람할 수 없습니다.");
            }

            renderSecrets(
                Array.isArray(result.secrets) ? result.secrets : []
            );

            secretsUnlocked = true;
            secretLockMessage.innerText = "";
            updateEditableState();
        } catch (error) {
    console.error("비밀 기록 열람 실패:", error);

    // 이전에 표시했던 비밀 기록을 비운다.
    renderSecrets([]);
    secretsUnlocked = false;

    if (secretLockMessage) {
        secretLockMessage.innerText =
            error.message || "열람 코드가 올바르지 않습니다.";
    }

    updateEditableState();
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
    // 공개 HTML에 들어 있을 수 있는 예시 비밀 기록도 먼저 비운다.
    renderSecrets([]);
    secretAccessCode = "";
    secretsUnlocked = false;

    try {
        const serverResult = await loadServerState();

        if (serverResult && serverResult.content) {
            applyState(serverResult.content);
        }

        // 비밀 기록은 관리자에게만 별도 API로 제공한다.
        const statusResponse = await fetch("/api/auth/status", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!statusResponse.ok) {
            throw new Error("로그인 상태를 확인할 수 없습니다.");
        }

        const status = await statusResponse.json();

        if (status.loggedIn === true) {
            const secretResponse = await fetch("/api/story/secrets", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!secretResponse.ok) {
                throw new Error("관리자 비밀 기록을 불러오지 못했습니다.");
            }

            const secretResult = await secretResponse.json();

            renderSecrets(
                Array.isArray(secretResult.secrets)
                    ? secretResult.secrets
                    : []
            );
        }
    } catch (error) {
        console.error("생애와 서사 초기화 실패:", error);
        editStatus.innerText = "서버 기록 확인 실패";
    }

    // 페이지를 열 때마다 잠금 화면부터 시작한다.
    secretsUnlocked = false;
    isEditing = false;
    secretAccessCode = "";

    updateEditableState();
}

initializeStory();


});
