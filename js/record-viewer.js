
"use strict";

(() => {
    const STORAGE_KEY = "inmulrok-editor-v1";

    const PAGE_NAMES = {
        profile: "인적 사항",
        appearance: "외형 기록",
        personality: "성격과 특징",
        story: "생애와 서사",
        relationships: "인물 관계"
    };

    const TYPE_NAMES = {
        paragraph: "기록",
        table: "표",
        stats: "능력치",
        keywords: "키워드",
        image: "이미지 기록",
        timeline: "연대기"
    };

    function escapeHtml(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function readDatabase() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;

            const database = JSON.parse(raw);

            if (!database || !Array.isArray(database.characters)) {
                return null;
            }

            return database;
        } catch (error) {
            console.error("인물록 기록을 읽을 수 없습니다.", error);
            return null;
        }
    }

    function safeImageUrl(value) {
        const url = String(value || "").trim();

        // 편집기에서 등록한 이미지와 허용된 이미지 주소만 표시
        if (/^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(url)) {
            return url;
        }

        if (/^https?:\/\//i.test(url)) {
            return url;
        }

        if (/^assets\/[a-z0-9_\-./]+\.(png|jpe?g|gif|webp)$/i.test(url)) {
            return url;
        }

        return "";
    }

    function renderParagraph(data) {
        return `<div class="record-viewer-paragraph">${
            escapeHtml(data.body || "").replace(/\n/g, "<br>")
        }</div>`;
    }

    function renderTable(data) {
        const rows = Array.isArray(data.rows) ? data.rows : [];

        if (!rows.length) {
            return `<p class="record-viewer-muted">표 내용이 없습니다.</p>`;
        }

        return `
            <div class="record-viewer-table-wrap">
                <table class="record-viewer-table">
                    ${rows.map((row, index) => `
                        <tr>
                            ${(Array.isArray(row) ? row : []).map(cell => {
                                const tag = index === 0 ? "th" : "td";
                                return `<${tag}>${escapeHtml(cell)}</${tag}>`;
                            }).join("")}
                        </tr>
                    `).join("")}
                </table>
            </div>
        `;
    }

    function renderStats(data) {
        const stats = Array.isArray(data.stats) ? data.stats : [];

        if (!stats.length) {
            return `<p class="record-viewer-muted">등록된 능력치가 없습니다.</p>`;
        }

        return stats.map(stat => {
            const value = Math.max(
                0,
                Math.min(100, Number(stat.value) || 0)
            );

            return `
                <div class="record-viewer-stat">
                    <div class="record-viewer-stat-label">
                        <span>${escapeHtml(stat.label)}</span>
                        <span>${value}/100</span>
                    </div>
                    <div class="record-viewer-stat-track">
                        <div class="record-viewer-stat-fill"
                             style="width:${value}%"></div>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderKeywords(data) {
        const tags = Array.isArray(data.tags) ? data.tags : [];

        if (!tags.length) {
            return `<p class="record-viewer-muted">등록된 키워드가 없습니다.</p>`;
        }

        return `
            <div class="record-viewer-tags">
                ${tags.map(tag => `
                    <span class="record-viewer-tag">${escapeHtml(tag)}</span>
                `).join("")}
            </div>
        `;
    }

    function renderImage(data, title) {
        const url = safeImageUrl(data.url);
        const caption = escapeHtml(data.caption || "");

        return `
            <div class="record-viewer-image-content">
                ${url
                    ? `<img src="${escapeHtml(url)}"
                            alt="${escapeHtml(title)}"
                            loading="lazy">`
                    : `<p class="record-viewer-muted">등록된 이미지가 없습니다.</p>`
                }
                ${caption ? `<p class="record-viewer-caption">${caption}</p>` : ""}
            </div>
        `;
    }

    function renderTimeline(data) {
        const events = Array.isArray(data.events) ? data.events : [];

        if (!events.length) {
            return `<p class="record-viewer-muted">등록된 사건이 없습니다.</p>`;
        }

        return `
            <div class="record-viewer-timeline">
                ${events.map(event => `
                    <article class="record-viewer-event">
                        <time>${escapeHtml(event.date || "")}</time>
                        <h4>${escapeHtml(event.title || "제목 없음")}</h4>
                        ${event.description
                            ? `<p>${escapeHtml(event.description)}</p>`
                            : ""}
                    </article>
                `).join("")}
            </div>
        `;
    }

    function renderContent(block) {
        const data = block.data || {};

        switch (block.type) {
            case "paragraph":
                return renderParagraph(data);
            case "table":
                return renderTable(data);
            case "stats":
                return renderStats(data);
            case "keywords":
                return renderKeywords(data);
            case "image":
                return renderImage(data, block.title);
            case "timeline":
                return renderTimeline(data);
            default:
                return `<p class="record-viewer-muted">지원하지 않는 기록 유형입니다.</p>`;
        }
    }

    function renderPage(container) {
        const pageKey = container.dataset.recordPage;

        if (!PAGE_NAMES[pageKey]) {
            console.warn("알 수 없는 인물록 페이지:", pageKey);
            return;
        }

        const database = readDatabase();
        const character = database?.characters?.[0];
        const blocks = character?.pages?.[pageKey];

        container.replaceChildren();

        if (!Array.isArray(blocks) || blocks.length === 0) {
            container.hidden = true;
            return;
        }

        container.hidden = false;

        const heading = document.createElement("div");
        heading.className = "record-viewer-heading";

        const title = document.createElement("h2");
        title.textContent = "추가 기록";

        const subtitle = document.createElement("p");
        subtitle.textContent = `${PAGE_NAMES[pageKey]} · 편집 페이지에서 작성한 기록`;

        heading.append(title, subtitle);
        container.appendChild(heading);

        const list = document.createElement("div");
        list.className = "record-viewer-list";

        blocks.forEach(block => {
            const article = document.createElement("article");
            article.className = "record-viewer-card";

            const cardHeading = document.createElement("div");
            cardHeading.className = "record-viewer-card-heading";

            const cardTitle = document.createElement("h3");
            cardTitle.textContent = block.title || "제목 없는 기록";

            const typeLabel = document.createElement("span");
            typeLabel.className = "record-viewer-type";
            typeLabel.textContent = TYPE_NAMES[block.type] || "기록";

            cardHeading.append(cardTitle, typeLabel);

            const content = document.createElement("div");
            content.className = "record-viewer-content";
            content.innerHTML = renderContent(block);

            article.append(cardHeading, content);
            list.appendChild(article);
        });

        container.appendChild(list);
    }

    function initialize() {
        document.querySelectorAll("[data-record-page]").forEach(renderPage);

        // 다른 탭에서 기록을 수정한 경우 표시를 갱신
        window.addEventListener("storage", event => {
            if (event.key !== STORAGE_KEY) return;

            document.querySelectorAll("[data-record-page]").forEach(renderPage);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initialize);
    } else {
        initialize();
    }
})();
