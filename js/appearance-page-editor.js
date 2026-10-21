
document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "inmulrok-appearance-page-v1";

    const page = document.querySelector(".appearance-page");
    const editButton = document.getElementById("edit-button");
    const saveButton = document.getElementById("save-button");
    const cancelButton = document.getElementById("cancel-button");
    const editStatus = document.getElementById("edit-status");
    const imageGrid = document.querySelector(".appearance-image-grid");
    const infoGrids = Array.from(
        document.querySelectorAll(".appearance-info-grid")
    );

    if (!page || !editButton || !saveButton || !cancelButton || !imageGrid) {
        return;
    }

    let savedState = null;
    let isEditing = false;

    infoGrids.forEach(function (grid, index) {
        grid.dataset.sectionId =
            ["basic", "body", "clothing"][index] || ("section-" + index);
    });

    function safeImage(source) {
        return typeof source === "string" &&
            (
                source.startsWith("assets/") ||
                /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,/i.test(source)
            );
    }

    function readState() {
        try {
            return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        } catch (error) {
            console.error("외형 기록을 불러오지 못했습니다.", error);
            return null;
        }
    }

    
async function loadServerState() {
    try {
        const response = await fetch("/api/records/appearance", {
            method: "GET",
            credentials: "same-origin",
            cache: "no-store"
        });

        if (!response.ok) {
            throw new Error("서버 기록 조회 실패: " + response.status);
        }

        return await response.json();
    } catch (error) {
        console.error("외형 기록 조회 실패:", error);
        return null;
    }
}

async function saveServerState(state) {
    const response = await fetch("/api/records/appearance", {
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


    function getTextState() {
        const text = {};

        page.querySelectorAll("[data-editable]").forEach(function (element) {
            text[element.dataset.editable] = element.innerText;
        });

        return text;
    }

    function getImageState() {
        const images = {};

        page.querySelectorAll("[data-editable-image]").forEach(function (image) {
            images[image.dataset.editableImage] = image.getAttribute("src");
        });

        return images;
    }

    function getAppearanceItems() {
        return infoGrids.map(function (grid) {
            return {
                group: grid.dataset.sectionId,
                items: Array.from(
                    grid.querySelectorAll(".appearance-info-item")
                ).map(function (row) {
                    const label = row.querySelector("dt");
                    const value = row.querySelector("dd");

                    return {
                        id: row.dataset.itemId,
                        key: value.dataset.editable || "",
                        label: label.innerText.trim(),
                        value: value.innerText
                    };
                })
            };
        });
    }

    function getPhotoCards() {
        return Array.from(
            imageGrid.querySelectorAll(".appearance-image-card")
        ).map(function (card) {
            const image = card.querySelector("img");
            const title = card.querySelector(".image-caption-title");
            const description = card.querySelector(".image-caption-description");

            return {
                id: card.dataset.photoId ||
                    (image ? image.dataset.editableImage : ""),
                src: image ? image.getAttribute("src") : "",
                alt: image ? image.alt : "",
                title: title ? title.innerText : "",
                description: description ? description.innerText : "",
                main: card.classList.contains("appearance-image-main")
            };
        });
    }

    function getCurrentState() {
        return {
            version: 2,
            text: getTextState(),
            images: getImageState(),
            appearanceItems: getAppearanceItems(),
            photoCards: getPhotoCards()
        };
    }

    // 편집 버튼 상태를 새로 생성한 항목에도 적용한다.
    function updateControlVisibility(container) {
        container.querySelectorAll(
            ".dynamic-item-controls, .image-edit-controls"
        ).forEach(function (controls) {
            controls.hidden = !isEditing;
        });

        container.querySelectorAll(".add-item-button").forEach(function (button) {
            button.hidden = !isEditing;
        });
    }

    function makeInfoRow(item) {
        const row = document.createElement("div");
        row.className = "appearance-info-item";
        row.dataset.itemId = item.id ||
            ("custom-" + Date.now() + "-" + Math.random().toString(16).slice(2));

        const label = document.createElement("dt");
        label.textContent = item.label || "새 항목";

        const value = document.createElement("dd");
        value.textContent = item.value || "";
        value.dataset.editable = item.key ||
            ("custom-" + row.dataset.itemId);

        label.contentEditable = isEditing ? "true" : "false";
        value.contentEditable = isEditing ? "true" : "false";

        const controls = document.createElement("div");
        controls.className = "dynamic-item-controls";
        controls.hidden = !isEditing;

        const up = document.createElement("button");
        up.type = "button";
        up.className = "edit-button item-move-button";
        up.textContent = "↑";
        up.title = "위로 이동";

        up.addEventListener("click", function () {
            const previous = row.previousElementSibling;
            if (previous) {
                row.parentElement.insertBefore(row, previous);
            }
        });

        const down = document.createElement("button");
        down.type = "button";
        down.className = "edit-button item-move-button";
        down.textContent = "↓";
        down.title = "아래로 이동";

        down.addEventListener("click", function () {
            const next = row.nextElementSibling;
            if (next) {
                row.parentElement.insertBefore(next, row);
            }
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "edit-button item-delete-button";
        remove.textContent = "삭제";

        remove.addEventListener("click", function () {
            if (confirm("이 외형 항목을 삭제할까요?")) {
                row.remove();
            }
        });

        controls.append(up, down, remove);
        row.append(label, value, controls);

        return row;
    }

    function renderAppearanceItems(groups) {
        groups.forEach(function (group) {
            const grid = infoGrids.find(function (item) {
                return item.dataset.sectionId === group.group;
            });

            if (!grid || !Array.isArray(group.items)) return;

            grid.replaceChildren();

            group.items.forEach(function (item) {
                grid.appendChild(makeInfoRow(item));
            });
        });
    }

    function uploadImage(file, callback) {
        if (!file) return;

        const allowed = [
            "image/jpeg",
            "image/png",
            "image/gif",
            "image/webp"
        ];

        if (!allowed.includes(file.type)) {
            alert("PNG, JPG, GIF, WEBP 이미지 파일만 사용할 수 있습니다.");
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            alert("이미지는 파일당 2MB 이하로 선택해 주세요.");
            return;
        }

        const reader = new FileReader();

        reader.onload = function () {
            if (typeof reader.result === "string") {
                callback(reader.result);
            } else {
                alert("이미지를 읽지 못했습니다.");
            }
        };

        reader.onerror = function () {
            alert("이미지를 읽는 중 오류가 발생했습니다.");
        };

        reader.readAsDataURL(file);
    }

    function makePhotoCard(photo) {
        const id = photo.id ||
            ("photo-" + Date.now() + "-" + Math.random().toString(16).slice(2));

        const card = document.createElement("figure");
        card.className = "appearance-image-card";
        card.dataset.photoId = id;

        if (photo.main) {
            card.classList.add("appearance-image-main");
        }

        const frame = document.createElement("div");
        frame.className = "appearance-image-frame";

        const image = document.createElement("img");
        image.className = "appearance-image";
        image.alt = photo.alt || photo.title || "외형 기록 이미지";
        image.dataset.editableImage = id;

        if (safeImage(photo.src)) {
            image.src = photo.src;
        } else {
            image.alt = photo.alt || "이미지를 선택해 주세요";
        }

        frame.appendChild(image);

        const caption = document.createElement("figcaption");

        const title = document.createElement("span");
        title.className = "image-caption-title";
        title.dataset.editable = id + "-title";
        title.textContent = photo.title || "사진 제목";
        title.contentEditable = isEditing ? "true" : "false";

        const description = document.createElement("span");
        description.className = "image-caption-description";
        description.dataset.editable = id + "-description";
        description.textContent = photo.description || "사진 설명";
        description.contentEditable = isEditing ? "true" : "false";

        caption.append(title, description);

        // 사진 편집 도구
        const controls = document.createElement("div");
        controls.className = "image-edit-controls";

        // 핵심 수정: 현재 편집 모드에 따라 표시 상태를 결정한다.
        controls.hidden = !isEditing;

        // 이미지 선택 버튼
        const label = document.createElement("label");
        label.className = "edit-button image-select-button";
        label.textContent = "이미지 선택";

        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/png,image/jpeg,image/gif,image/webp";
        input.hidden = true;

        input.addEventListener("change", function () {
            uploadImage(input.files[0], function (source) {
                image.src = source;
            });

            input.value = "";
        });

        label.appendChild(input);

        // 사진 삭제 버튼
        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "edit-button item-delete-button";
        remove.textContent = "사진 삭제";

        remove.addEventListener("click", function () {
            if (confirm("이 사진을 삭제할까요?")) {
                card.remove();
            }
        });

        controls.append(label, remove);
        card.append(frame, caption, controls);

        return card;
    }

    function renderPhotos(photos) {
        imageGrid.replaceChildren();

        photos.forEach(function (photo) {
            imageGrid.appendChild(makePhotoCard(photo));
        });

        updateControlVisibility(imageGrid);
    }

    // 사진 추가 버튼
    const addPhotoButton = document.createElement("button");
    addPhotoButton.type = "button";
    addPhotoButton.className = "edit-button add-item-button";
    addPhotoButton.textContent = "+ 사진 추가";
    addPhotoButton.hidden = true;

    addPhotoButton.addEventListener("click", function () {
        const photo = makePhotoCard({
            id: "photo-" + Date.now(),
            title: "새 사진",
            description: "설명을 입력하세요",
            src: ""
        });

        imageGrid.appendChild(photo);

        // 핵심 수정: 새로 추가한 사진의 버튼을 즉시 표시한다.
        updateControlVisibility(photo);

        const title = photo.querySelector(".image-caption-title");
        if (title) title.focus();
    });

    const gallery = page.querySelector(".appearance-gallery");

    if (gallery) {
        gallery.appendChild(addPhotoButton);
    }

    // 각 외형 정보 영역에 항목 추가 버튼 생성
    infoGrids.forEach(function (grid) {
        const addButton = document.createElement("button");
        addButton.type = "button";
        addButton.className = "edit-button add-item-button";
        addButton.textContent = "+ 항목 추가";
        addButton.hidden = true;

        addButton.addEventListener("click", function () {
            const row = makeInfoRow({
                id: "custom-" + Date.now(),
                key: "custom-" + Date.now(),
                label: "새 항목",
                value: "내용을 입력하세요"
            });

            grid.appendChild(row);
            updateControlVisibility(row);

            const label = row.querySelector("dt");
            if (label) label.focus();
        });

        grid.insertAdjacentElement("afterend", addButton);
    });

    function setEditing(enabled) {
        isEditing = enabled;
        page.classList.toggle("is-editing", enabled);

        page.querySelectorAll("[data-editable]").forEach(function (element) {
            element.contentEditable = enabled ? "true" : "false";
            element.spellcheck = enabled;
        });

        page.querySelectorAll("dt").forEach(function (element) {
            if (element.closest(".appearance-info-item")) {
                element.contentEditable = enabled ? "true" : "false";
                element.spellcheck = enabled;
            }
        });

        updateControlVisibility(page);

        editButton.hidden = enabled;
        saveButton.hidden = !enabled;
        cancelButton.hidden = !enabled;

        editStatus.textContent = enabled
            ? "편집 모드 · 수정 중"
            : "열람 모드";
    }

    function applyState(state) {
        if (!state || typeof state !== "object") return;

        // 이전 버전의 텍스트 저장 형식 지원
        if (state.text && typeof state.text === "object") {
            page.querySelectorAll("[data-editable]").forEach(function (element) {
                const key = element.dataset.editable;

                if (typeof state.text[key] === "string") {
                    element.textContent = state.text[key];
                }
            });
        }

        // 이전 버전의 이미지 저장 형식 지원
        if (state.images && typeof state.images === "object") {
            page.querySelectorAll("[data-editable-image]").forEach(function (image) {
                const key = image.dataset.editableImage;

                if (safeImage(state.images[key])) {
                    image.src = state.images[key];
                }
            });
        }

        if (Array.isArray(state.appearanceItems)) {
            renderAppearanceItems(state.appearanceItems);
        }

        if (Array.isArray(state.photoCards)) {
            renderPhotos(state.photoCards);
        }
    }

    editButton.addEventListener("click", function () {
        savedState = getCurrentState();
        setEditing(true);
    });

    cancelButton.addEventListener("click", function () {
        if (savedState) {
            applyState(savedState);
        }

        setEditing(false);
    });

    saveButton.addEventListener("click", async function () {
    const state = getCurrentState();

    saveButton.disabled = true;
    editStatus.textContent = "저장 중...";

    try {
        // 서버 저장을 먼저 시도한다.
        await saveServerState(state);

        // 서버 저장 성공 후 브라우저에도 백업한다.
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

        savedState = state;
        setEditing(false);
        editStatus.textContent = "저장 완료";
    } catch (error) {
        console.error("외형 기록 저장 실패:", error);

        alert(
            "서버 저장에 실패했습니다.\n" +
            error.message +
            "\n수정한 내용은 저장되지 않았으니 페이지를 새로고침하지 마세요."
        );

        editStatus.textContent = "저장 실패";
    } finally {
        saveButton.disabled = false;
    }
});

    // 초기 로드: 기존 저장 데이터를 우선 적용한다.
    // 서버 기록과 기존 브라우저 기록을 확인한다.
async function initializeAppearance() {
    const localState = readState();
    const serverResult = await loadServerState();

    let initialState = null;

    if (serverResult && serverResult.content) {
        // 서버 기록이 있으면 서버 데이터를 우선 사용한다.
        initialState = serverResult.content;
        applyState(initialState);

        try {
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(initialState)
            );
        } catch (error) {
            console.warn("브라우저 백업 저장 실패:", error);
        }
    } else if (localState) {
        // 서버 기록이 없으면 기존 브라우저 기록을 유지한다.
        initialState = localState;
        applyState(initialState);

        // 관리자 로그인 상태라면 기존 기록을 서버로 이전한다.
        try {
            const response = await fetch("/api/auth/status", {
                credentials: "same-origin",
                cache: "no-store"
            });

            if (response.ok) {
                const status = await response.json();

                if (status.loggedIn) {
                    await saveServerState(localState);
                    console.log("기존 외형 기록을 서버로 이전했습니다.");
                }
            }
        } catch (error) {
            console.error("기존 외형 기록 이전 실패:", error);
        }
    }

    // 기존 HTML에 있던 외형 항목을 유지한다.
    if (!initialState || !Array.isArray(initialState.appearanceItems)) {
        infoGrids.forEach(function (grid) {
            const oldRows = Array.from(
                grid.querySelectorAll(".appearance-info-item")
            ).map(function (row) {
                const label = row.querySelector("dt");
                const value = row.querySelector("dd");

                if (!label || !value) return null;

                return {
                    id: value.dataset.editable ||
                        ("item-" + Math.random().toString(16).slice(2)),
                    key: value.dataset.editable || "",
                    label: label.innerText.trim(),
                    value: value.innerText
                };
            }).filter(Boolean);

            grid.replaceChildren();

            oldRows.forEach(function (item) {
                grid.appendChild(makeInfoRow(item));
            });
        });
    }

    // 기존 HTML에 있던 사진을 유지한다.
    if (!initialState || !Array.isArray(initialState.photoCards)) {
        const oldPhotos = Array.from(
            imageGrid.querySelectorAll(".appearance-image-card")
        ).map(function (card) {
            const image = card.querySelector("img");
            const title = card.querySelector(".image-caption-title");
            const description = card.querySelector(
                ".image-caption-description"
            );

            if (!image) return null;

            return {
                id: image.dataset.editableImage ||
                    ("photo-" + Math.random().toString(16).slice(2)),
                src: image.getAttribute("src"),
                alt: image.alt,
                title: title ? title.innerText : "",
                description: description ? description.innerText : "",
                main: card.classList.contains("appearance-image-main")
            };
        }).filter(Boolean);

        renderPhotos(oldPhotos);
    }

    setEditing(false);
}

initializeAppearance();
});
