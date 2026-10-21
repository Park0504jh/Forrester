
document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "inmulrok-profile-page-v1";

    const page = document.querySelector(".profile-page");
    const editButton = document.getElementById("edit-button");
    const saveButton = document.getElementById("save-button");
    const cancelButton = document.getElementById("cancel-button");
    const editStatus = document.getElementById("edit-status");
    const portrait = document.getElementById("profile-portrait");
    const portraitUpload = document.getElementById("portrait-upload");
    const imageControls = document.querySelector(".portrait-column .image-edit-controls");
    const infoList = document.querySelector(".information-list");
    const infoSection = document.querySelector(".basic-information");

    if (!page || !editButton || !saveButton || !cancelButton ||
        !portrait || !portraitUpload || !infoList || !infoSection) {
        return;
    }

    let savedState = null;
    let isEditing = false;

    function safeImage(source) {
        return typeof source === "string" &&
            (source.startsWith("assets/") ||
             /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(source));
    }

    function readState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        } catch (error) {
            console.error("인적 사항 기록을 불러오지 못했습니다.", error);
            return null;
        }
    }

    async function loadServerState() {
    try {
        const response = await fetch("/api/records/profile", {
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("서버 기록을 불러오지 못했습니다.");
        }

        return await response.json();
    } catch (error) {
        console.error("서버 기록 조회 실패:", error);
        return null;
    }
}

async function saveServerState(state) {
    const response = await fetch("/api/records/profile", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: state
        })
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
        throw new Error(
            result.message || "서버에 기록을 저장하지 못했습니다."
        );
    }

    return result;
}

    function getTextState() {
        const text = {};
        page.querySelectorAll("[data-editable]").forEach(function (element) {
            text[element.dataset.editable] = element.innerText;
        });
        return text;
    }

    function getInfoItems() {
        return Array.from(infoList.querySelectorAll(".information-item")).map(function (row) {
            const label = row.querySelector("dt");
            const value = row.querySelector("dd");
            return {
                id: row.dataset.itemId,
                key: value.dataset.editable || "",
                label: label.innerText.trim(),
                value: value.innerText
            };
        });
    }

    function getCurrentState() {
        return {
            version: 2,
            text: getTextState(),
            image: portrait.getAttribute("src"),
            infoItems: getInfoItems()
        };
    }

    function makeRow(item) {
        const row = document.createElement("div");
        row.className = "information-item";
        row.dataset.itemId = item.id || ("custom-" + Date.now() + "-" + Math.random().toString(16).slice(2));

        const label = document.createElement("dt");
        label.textContent = item.label || "새 항목";

        const value = document.createElement("dd");
        value.textContent = item.value || "";
        value.dataset.editable = item.key || ("custom-" + row.dataset.itemId);

        const controls = document.createElement("div");
        controls.className = "dynamic-item-controls";
        controls.hidden = true;

        const up = document.createElement("button");
        up.type = "button";
        up.className = "edit-button item-move-button";
        up.textContent = "↑";
        up.title = "위로 이동";
        up.addEventListener("click", function () {
            const previous = row.previousElementSibling;
            if (previous) infoList.insertBefore(row, previous);
        });

        const down = document.createElement("button");
        down.type = "button";
        down.className = "edit-button item-move-button";
        down.textContent = "↓";
        down.title = "아래로 이동";
        down.addEventListener("click", function () {
            const next = row.nextElementSibling;
            if (next) infoList.insertBefore(next, row);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "edit-button item-delete-button";
        remove.textContent = "삭제";
        remove.addEventListener("click", function () {
            if (confirm("이 기본 정보 항목을 삭제할까요?")) row.remove();
        });

        controls.append(up, down, remove);
        row.append(label, value, controls);
        return row;
    }

    function renderItems(items) {
        infoList.replaceChildren();
        items.forEach(function (item) {
            infoList.appendChild(makeRow(item));
        });
    }

    const addItemButton = document.createElement("button");
    addItemButton.type = "button";
    addItemButton.className = "edit-button add-item-button";
    addItemButton.textContent = "+ 기본 정보 추가";
    addItemButton.hidden = true;
    addItemButton.addEventListener("click", function () {
        const row = makeRow({
            id: "custom-" + Date.now(),
            key: "custom-" + Date.now(),
            label: "새 항목",
            value: "내용을 입력하세요"
        });
        infoList.appendChild(row);
        row.querySelector("dt").focus();
    });
    infoSection.appendChild(addItemButton);

    function setEditing(enabled) {
        isEditing = enabled;
        page.classList.toggle("is-editing", enabled);

        page.querySelectorAll("[data-editable]").forEach(function (element) {
            element.contentEditable = enabled ? "true" : "false";
            element.spellcheck = enabled;
        });

        infoList.querySelectorAll("dt").forEach(function (label) {
            label.contentEditable = enabled ? "true" : "false";
            label.spellcheck = enabled;
        });

        infoList.querySelectorAll(".dynamic-item-controls").forEach(function (control) {
            control.hidden = !enabled;
        });

        addItemButton.hidden = !enabled;
        if (imageControls) imageControls.hidden = !enabled;

        editButton.hidden = enabled;
        saveButton.hidden = !enabled;
        cancelButton.hidden = !enabled;
        editStatus.textContent = enabled ? "편집 모드 · 수정 중" : "열람 모드";
    }

    function applyState(state) {
        if (!state || typeof state !== "object") return;

        // 이전 버전에서 저장한 텍스트도 그대로 불러온다.
        if (state.text && typeof state.text === "object") {
            page.querySelectorAll("[data-editable]").forEach(function (element) {
                const key = element.dataset.editable;
                if (typeof state.text[key] === "string") {
                    element.textContent = state.text[key];
                }
            });
        }

        if (safeImage(state.image)) portrait.src = state.image;

        if (Array.isArray(state.infoItems)) {
            renderItems(state.infoItems);
        }
    }

    function startEditing() {
        savedState = getCurrentState();
        setEditing(true);
    }

    function cancelEditing() {
        if (savedState) applyState(savedState);
        portraitUpload.value = "";
        setEditing(false);
    }

    async function saveEditing() {
    const state = getCurrentState();

    saveButton.disabled = true;
    editStatus.textContent = "저장 중...";

    try {
        // 서버에 먼저 저장한다.
        await saveServerState(state);

        // 서버 저장 성공 후 브라우저에도 백업한다.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        savedState = state;
        portraitUpload.value = "";
        setEditing(false);
        editStatus.textContent = "저장 완료";
    } catch (error) {
        console.error("인적 사항 저장 실패:", error);

        alert(
            "서버 저장에 실패했습니다.\n" +
            error.message +
            "\n수정한 내용은 저장되지 않았으니 페이지를 새로고침하지 마세요."
        );

        editStatus.textContent = "저장 실패";
    } finally {
        saveButton.disabled = false;
    }
}

    editButton.addEventListener("click", startEditing);
    cancelButton.addEventListener("click", cancelEditing);
    saveButton.addEventListener("click", saveEditing);

    portraitUpload.addEventListener("change", function () {
        const file = portraitUpload.files[0];
        if (!file) return;

        const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
        if (!allowed.includes(file.type)) {
            alert("PNG, JPG, GIF, WEBP 이미지 파일만 사용할 수 있습니다.");
            portraitUpload.value = "";
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            alert("이미지는 2MB 이하로 선택해 주세요.");
            portraitUpload.value = "";
            return;
        }

        const reader = new FileReader();
        reader.onload = function () {
            if (typeof reader.result === "string") portrait.src = reader.result;
        };
        reader.onerror = function () {
            alert("이미지를 읽는 중 오류가 발생했습니다.");
        };
        reader.readAsDataURL(file);
    });

    
    async function initializeProfile() {
    const localState = readState();
    const serverResult = await loadServerState();

    if (serverResult && serverResult.content) {
        // 서버에 기록이 있다면 서버 기록을 사용한다.
        applyState(serverResult.content);

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(serverResult.content)
            );
        } catch (error) {
            console.warn("브라우저 백업 저장 실패:", error);
        }
    } else if (localState) {
        // 서버 기록이 없으면 기존 브라우저 기록을 유지한다.
        applyState(localState);

        // 관리자 로그인 상태일 때만 기존 기록을 서버로 이전한다.
        try {
            const statusResponse = await fetch("/api/auth/status", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (statusResponse.ok) {
                const status = await statusResponse.json();

                if (status.loggedIn) {
                    await saveServerState(localState);
                    console.log("기존 인적 사항 기록을 서버로 이전했습니다.");
                }
            }
        } catch (error) {
            console.error("기존 기록 이전 실패:", error);
        }
    }

    const currentState = serverResult?.content || localState;

    if (!currentState || !Array.isArray(currentState.infoItems)) {
        const initialItems = Array.from(
            infoList.querySelectorAll(".information-item")
        ).map(function (row) {
            const label = row.querySelector("dt");
            const value = row.querySelector("dd");

            return {
                id: value.dataset.editable ||
                    ("item-" + Math.random().toString(16).slice(2)),
                key: value.dataset.editable || "",
                label: label.innerText.trim(),
                value: value.innerText
            };
        });

        renderItems(initialItems);
    }

    setEditing(false);
}

initializeProfile();

});
