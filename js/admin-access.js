
(function () {
    // 로그인 확인이 끝날 때까지 편집 도구를 숨깁니다.
    const style = document.createElement("style");

    style.textContent = `
        body:not(.admin-authenticated) .page-edit-toolbar,
        body:not(.admin-authenticated) .edit-status,
        body:not(.admin-authenticated) .edit-actions,
        body:not(.admin-authenticated) .edit-button,
        body:not(.admin-authenticated) #edit-button,
        body:not(.admin-authenticated) #save-button,
        body:not(.admin-authenticated) #cancel-button,
        body:not(.admin-authenticated) [data-admin-only] {
            display: none !important;
        }
    `;

    document.head.appendChild(style);

    async function checkAdminAccess() {
        try {
            const response = await fetch("/api/auth/status", {
                method: "GET",
                credentials: "same-origin",
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error("로그인 상태를 확인할 수 없습니다.");
            }

            const data = await response.json();

            if (data.loggedIn === true) {
                document.body.classList.add("admin-authenticated");
            } else {
                document.body.classList.remove("admin-authenticated");
            }
        } catch (error) {
            // 서버 연결에 실패하면 방문자 모드로 유지합니다.
            document.body.classList.remove("admin-authenticated");
            console.error("관리자 인증 확인 실패:", error);
        }
    }

    checkAdminAccess();
})();
