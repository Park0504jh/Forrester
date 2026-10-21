document.addEventListener("DOMContentLoaded", function () {
    const STORAGE_KEY = "inmulrok-personality-page-v2";

    const page = document.querySelector(".personality-page");
    const main = document.querySelector(".personality-main");

    if (!page || !main) {
        return;
    }

    const editButton = document.getElementById("edit-button");
    const saveButton = document.getElementById("save-button");
    const cancelButton = document.getElementById("cancel-button");
    const editStatus = document.getElementById("edit-status");

    let originalContent = "";
    let isEditing = false;

    /*
     * 항목별 설정
     * HTML의 목록 ID와 항목 클래스에 맞춰 추가·삭제 기능을 처리합니다.
     */
    const listSettings = {
        "keyword-list": {
            className: "keyword-card",
            titleField: "keyword-title",
            descriptionField: "keyword-description",
            title: "새 키워드",
            description: "이 키워드가 인물의 성격을 어떻게 드러내는지 기록하세요."
        },
        "tendency-list": {
            className: "detail-card",
            titleField: "tendency-title",
            descriptionField: "tendency-description",
            title: "새 성향",
            description: "이 인물의 사고방식이나 행동 양식을 기록하세요."
        },
        "preference-list": {
            className: "detail-card",
            titleField: "preference-title",
            descriptionField: "preference-description",
            title: "새 선호 항목",
            description: "좋아하거나 싫어하는 것, 관심사를 기록하세요."
        },
        "extra-list": {
            className: "detail-card",
            titleField: "extra-title",
            descriptionField: "extra-description",
            title: "새 특징",
            description: "그 밖에 기록하고 싶은 특징을 적어 주세요."
        }
    };

    /*
     * 저장된 내용 불러오기
     */
    function loadSavedContent() {
        try {
            const savedContent = localStorage.getItem(STORAGE_KEY);

            if (savedContent) {
                main.innerHTML = savedContent;
            }
        } catch (error) {
            console.warn("성격 페이지의 저장된 내용을 불러오지 못했습니다.", error);
        }
    }

    
async function loadServerState() {
    const response = await fetch("/api/records/personality", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error("서버 기록을 불러오지 못했습니다: " + response.status);
    }

    return await response.json();
}

async function saveServerState(content) {
    const response = await fetch("/api/records/personality", {
        method: "PUT",
        credentials: "same-origin",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            content: {
                version: 1,
                html: content
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

    return result;
}


    /*
     * 편집 버튼 상태 갱신
     */
    function setStatus(message) {
        if (editStatus) {
            editStatus.textContent = message;
        }
    }

    /*
     * 저장 데이터에서 편집 전용 요소 제거
     */
    function createSaveContent() {
        const clone = main.cloneNode(true);

        clone.querySelectorAll(
            ".item-controls, .temporary-edit-control"
        ).forEach(function (element) {
            element.remove();
        });

        clone.querySelectorAll("[contenteditable]").forEach(function (element) {
            element.removeAttribute("contenteditable");
        });

        clone.querySelectorAll("[data-editing-control]").forEach(function (element) {
            element.remove();
        });

        clone.querySelectorAll("[hidden]").forEach(function (element) {
            if (
                element.matches(".add-item-button") ||
                element.matches(".add-item-area")
            ) {
                element.setAttribute("hidden", "");
            }
        });

        clone.querySelectorAll(".record-viewer").forEach(function (element) {
            element.innerHTML = "";
            element.setAttribute("hidden", "");
        });

        return clone.innerHTML;
    }

    /*
     * 편집 가능한 텍스트 설정
     */
    function setEditable(enabled) {
        const editableElements = main.querySelectorAll("[data-editable]");

        editableElements.forEach(function (element) {
            if (enabled) {
                element.setAttribute("contenteditable", "true");
                element.setAttribute("spellcheck", "false");
            } else {
                element.removeAttribute("contenteditable");
                element.removeAttribute("spellcheck");
            }
        });
    }

    /*
     * 항목 추가 버튼 표시
     */
    function updateAddButtons() {
        Object.keys(listSettings).forEach(function (listId) {
            const list = document.getElementById(listId);

            if (!list) {
                return;
            }

            const section = list.closest(".personality-section");
            const addButton = section
                ? section.querySelector("#add-" + listId.replace("-list", "") + "-button")
                : null;

            if (addButton) {
                addButton.hidden = !isEditing;
            }
        });

        /*
         * HTML에서 사용하는 실제 버튼 ID도 함께 확인합니다.
         */
        [
            "add-keyword-button",
            "add-tendency-button",
            "add-preference-button",
            "add-extra-button"
        ].forEach(function (buttonId) {
            const button = document.getElementById(buttonId);

            if (button) {
                button.hidden = !isEditing;
            }
        });
    }

    /*
     * 각 카드에 편집 중에만 나타나는 삭제 버튼 생성
     */
    function createItemControls() {
        main.querySelectorAll(".keyword-card, .detail-card").forEach(function (card) {
            if (card.querySelector(".item-controls")) {
                return;
            }

            const controls = document.createElement("div");
            controls.className = "item-controls";
            controls.setAttribute("data-editing-control", "");

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "delete-item-button";
            deleteButton.textContent = "항목 삭제";
            deleteButton.setAttribute("aria-label", "이 항목 삭제");

            controls.appendChild(deleteButton);
            card.appendChild(controls);
        });
    }

    /*
     * 편집 상태 변경
     */
    function enterEditMode() {
        if (isEditing) {
            return;
        }

        originalContent = main.innerHTML;
        isEditing = true;

        page.classList.add("is-editing");
        setEditable(true);
        createItemControls();
        updateAddButtons();

        if (editButton) {
            editButton.hidden = true;
        }

        if (saveButton) {
            saveButton.hidden = false;
        }

        if (cancelButton) {
            cancelButton.hidden = false;
        }

        setStatus("편집 중입니다.");
    }

    /*
     * 편집 취소
     */
    function cancelEdit() {
        if (!isEditing) {
            return;
        }

        main.innerHTML = originalContent;
        isEditing = false;

        page.classList.remove("is-editing");
        setEditable(false);
        updateAddButtons();

        if (editButton) {
            editButton.hidden = false;
        }

        if (saveButton) {
            saveButton.hidden = true;
        }

        if (cancelButton) {
            cancelButton.hidden = true;
        }

        setStatus("변경 사항을 취소했습니다.");
    }

    /*
     * 편집 내용 저장
     */
    
async function saveEdit() {
    if (!isEditing) {
        return;
    }

    if (saveButton) {
        saveButton.disabled = true;
    }

    setStatus("서버에 저장 중...");

    setEditable(false);
    const savedContent = createSaveContent();

    try {
        // 서버 저장이 성공해야 편집을 종료한다.
        await saveServerState(savedContent);

        // 서버 저장 성공 후 브라우저에도 백업한다.
        localStorage.setItem(STORAGE_KEY, savedContent);

        main.innerHTML = savedContent;
        isEditing = false;

        page.classList.remove("is-editing");
        setEditable(false);
        updateAddButtons();

        if (editButton) editButton.hidden = false;
        if (saveButton) saveButton.hidden = true;
        if (cancelButton) cancelButton.hidden = true;

        setStatus("서버 저장 완료");
    } catch (error) {
        console.error("성격 기록 저장 실패:", error);

        // 실패하면 편집 상태를 유지해 다시 저장할 수 있게 한다.
        setEditable(true);
        setStatus("저장 실패");

        alert(
            "성격 기록을 서버에 저장하지 못했습니다.\n" +
            error.message +
            "\n페이지를 새로고침하지 마세요."
        );
    } finally {
        if (saveButton) {
            saveButton.disabled = false;
        }
    }
}


    /*
     * 새 카드 생성
     */
    function createNewItem(listId) {
        const list = document.getElementById(listId);
        const settings = listSettings[listId];

        if (!list || !settings || !isEditing) {
            return;
        }

        const item = document.createElement("article");
        item.className = settings.className;

        if (listId === "keyword-list") {
            item.innerHTML = `
                <div class="keyword-card-heading">
                    <span class="keyword-mark" aria-hidden="true">記</span>
                    <h3 data-editable="${settings.titleField}">${settings.title}</h3>
                </div>
                <p data-editable="${settings.descriptionField}">${settings.description}</p>
            `;
        } else {
            item.innerHTML = `
                <div class="detail-card-heading">
                    <h3 data-editable="${settings.titleField}">${settings.title}</h3>
                </div>
                <p data-editable="${settings.descriptionField}">${settings.description}</p>
            `;
        }

        list.appendChild(item);

        setEditable(true);
        createItemControls();
        updateAddButtons();

        const title = item.querySelector("[data-editable]");
        if (title) {
            title.focus();
        }
    }

    /*
     * 버튼 이벤트
     */
    if (editButton) {
        editButton.addEventListener("click", enterEditMode);
    }

    if (saveButton) {
        saveButton.addEventListener("click", saveEdit);
    }

    if (cancelButton) {
        cancelButton.addEventListener("click", cancelEdit);
    }

    /*
     * 항목 추가 및 삭제는 이벤트 위임으로 처리합니다.
     * 새로 추가된 항목에도 별도의 이벤트 등록이 필요하지 않습니다.
     */
    page.addEventListener("click", function (event) {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        const addButton = target.closest("button[id^='add-'][id$='-button']");

        if (addButton && isEditing) {
            const buttonToList = {
                "add-keyword-button": "keyword-list",
                "add-tendency-button": "tendency-list",
                "add-preference-button": "preference-list",
                "add-extra-button": "extra-list"
            };

            const listId = buttonToList[addButton.id];

            if (listId) {
                createNewItem(listId);
            }

            return;
        }

        const deleteButton = target.closest(".delete-item-button");

        if (deleteButton && isEditing) {
            const item = deleteButton.closest(".keyword-card, .detail-card");

            if (item) {
                const confirmed = window.confirm("이 항목을 삭제할까요?");

                if (confirmed) {
                    item.remove();
                }
            }
        }
    });

   
/*
 * 초기화
 */
async function initializePersonality() {
    try {
        const serverResult = await loadServerState();

        if (
            serverResult &&
            serverResult.content &&
            typeof serverResult.content.html === "string"
        ) {
            main.innerHTML = serverResult.content.html;

            try {
                localStorage.setItem(
                    STORAGE_KEY,
                    serverResult.content.html
                );
            } catch (error) {
                console.warn("브라우저 백업 저장 실패:", error);
            }
        } else {
            // 서버에 저장된 기록이 없다면 기존 브라우저 기록을 사용한다.
            loadSavedContent();
        }
    } catch (error) {
        console.error("성격 기록 불러오기 실패:", error);

        // 서버 연결에 실패해도 기존 브라우저 기록을 복구한다.
        loadSavedContent();
    }

    isEditing = false;
    page.classList.remove("is-editing");
    setEditable(false);
    createItemControls();
    updateAddButtons();

    if (editButton) editButton.hidden = false;
    if (saveButton) saveButton.hidden = true;
    if (cancelButton) cancelButton.hidden = true;

    setStatus("열람 모드");
}

initializePersonality();

});