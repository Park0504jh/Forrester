
const express = require("express");
const session = require("express-session");
const SQLiteStore = require("connect-sqlite3")(session);
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = path.join(__dirname, "..");

// 배포 시 DATA_DIR=/data로 지정하면 영구 저장 공간 사용
const DATA_DIR = process.env.DATA_DIR || __dirname;

fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, "inmulrok.sqlite");

if (!process.env.SESSION_SECRET) {
    console.error(
        "SESSION_SECRET 환경 변수를 먼저 설정해 주세요."
    );
    process.exit(1);
}

if (
    process.env.NODE_ENV === "production" &&
    !process.env.SESSION_STORE_CONFIGURED
) {
    console.error(
        "배포 전 영구 세션 저장소 설정이 필요합니다."
    );
    process.exit(1);
}

const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS admin (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS records (
        page_key TEXT PRIMARY KEY,
        content_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);

db.exec(`
    CREATE TABLE IF NOT EXISTS story_secrets (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        content_json TEXT NOT NULL DEFAULT '{"secrets":[]}',
        access_code_hash TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
`);


/* ========================================
   기존 생애와 서사 비밀 기록 이전
======================================== */

function migrateStorySecrets() {
    const existingStory = db.prepare(`
        SELECT content_json
        FROM records
        WHERE page_key = 'story'
    `).get();

    if (!existingStory) {
        return;
    }

    const state = JSON.parse(existingStory.content_json);

    // 비밀 기록이 이미 별도 저장소에 있다면 다시 덮어쓰지 않는다.
    const existingSecrets = db.prepare(`
        SELECT id
        FROM story_secrets
        WHERE id = 1
    `).get();

    if (!existingSecrets) {
        const secrets = Array.isArray(state.secrets)
            ? state.secrets
            : [];

        const accessCode =
            typeof state.accessCode === "string"
                ? state.accessCode
                : "";

        // bcrypt는 최대 72바이트의 비밀번호를 처리한다.
        const accessCodeHash =
            accessCode &&
            Buffer.byteLength(accessCode, "utf8") <= 72
                ? bcrypt.hashSync(accessCode, 12)
                : "";

        db.prepare(`
            INSERT INTO story_secrets (
                id,
                content_json,
                access_code_hash
            )
            VALUES (1, ?, ?)
        `).run(
            JSON.stringify({ secrets }),
            accessCodeHash
        );
    }

    // 공개 기록에서 비밀 내용과 열람 코드를 제거한다.
    delete state.secrets;
    delete state.accessCode;
    delete state.secretsUnlocked;

    db.prepare(`
        UPDATE records
        SET content_json = ?,
            updated_at = CURRENT_TIMESTAMP
        WHERE page_key = 'story'
    `).run(JSON.stringify(state));
}

migrateStorySecrets();


app.disable("x-powered-by");

if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
}

app.use(helmet({
    contentSecurityPolicy: false
}));

app.use(express.json({ limit: "5mb" }));

app.use((req, res, next) => {
    const blocked = [
        "/server",
        "/node_modules",
        "/package.json",
        "/package-lock.json",
        "/.env"
    ];

    if (
        blocked.some(
            item =>
                req.path === item ||
                req.path.startsWith(item + "/")
        )
    ) {
        return res.sendStatus(404);
    }

    next();
});

app.use(session({
    store: new SQLiteStore({
        dir: DATA_DIR,
        db: "sessions.sqlite"
    }),
    name: "inmulrok.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        maxAge: 2 * 60 * 60 * 1000
    }
}));

const setupLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
});

function hasAdmin() {
    return Boolean(
        db.prepare("SELECT id FROM admin WHERE id = 1").get()
    );
}

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        message: "관리자 로그인이 필요합니다."
    });
}

// 관리자 설정 여부 확인
app.get("/api/auth/status", (req, res) => {
    res.json({
        configured: hasAdmin(),
        loggedIn: req.session?.isAdmin === true
    });
});

// 저장할 수 있는 페이지 이름 목록
const allowedPages = new Set([
    "home",
    "profile",
    "appearance",
    "personality",
    "story",
    "relationships"
]);


/* ========================================
   페이지 기록 조회
======================================== */

app.get("/api/records/:page", (req, res) => {
    const page = req.params.page;

    if (!allowedPages.has(page)) {
        return res.status(404).json({
            message: "존재하지 않는 기록 페이지입니다."
        });
    }

    const record = db.prepare(`
        SELECT content_json, updated_at
        FROM records
        WHERE page_key = ?
    `).get(page);

    if (!record) {
        return res.json({
            page,
            content: null,
            updatedAt: null
        });
    }

    const content = JSON.parse(record.content_json);

    // 비밀 기록과 열람 코드는 공개 응답에서 제외한다.
    if (page === "story") {
        delete content.secrets;
        delete content.accessCode;
        delete content.secretsUnlocked;
    }

    res.json({
        page,
        content,
        updatedAt: record.updated_at
    });
});


/* ========================================
   관리자 전용 비밀 기록 조회
======================================== */

app.get("/api/story/secrets", requireAdmin, (req, res) => {
    const record = db.prepare(`
        SELECT content_json, access_code_hash
        FROM story_secrets
        WHERE id = 1
    `).get();

    res.json({
        secrets: record
            ? JSON.parse(record.content_json).secrets || []
            : [],
        hasAccessCode: Boolean(record?.access_code_hash)
    });
});


/* ========================================
   관리자 전용 비밀 열람 코드 설정
======================================== */

app.put("/api/story/access-code", requireAdmin, async (req, res, next) => {
    try {
        const code = req.body?.code;

        if (
            typeof code !== "string" ||
            code.trim() === "" ||
            Buffer.byteLength(code, "utf8") > 72
        ) {
            return res.status(400).json({
                message: "열람 코드는 비어 있을 수 없으며 UTF-8 기준 72바이트 이하여야 합니다."
            });
        }

        const codeHash = await bcrypt.hash(code, 12);

        db.prepare(`
            INSERT INTO story_secrets (
                id,
                content_json,
                access_code_hash,
                updated_at
            )
            VALUES (1, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO UPDATE SET
                access_code_hash = excluded.access_code_hash,
                updated_at = CURRENT_TIMESTAMP
        `).run(
            JSON.stringify({ secrets: [] }),
            codeHash
        );

        res.json({
            success: true,
            message: "열람 코드가 변경되었습니다."
        });
    } catch (error) {
        next(error);
    }
});

app.post("/api/story/unlock", loginLimiter, async (req, res, next) => {
    try {
        const code = req.body?.code;

        if (typeof code !== "string" || !code || Buffer.byteLength(code, "utf8") > 72) {
            return res.status(400).json({
                message: "열람 코드를 확인해 주세요."
            });
        }

        const record = db.prepare(`
            SELECT content_json, access_code_hash
            FROM story_secrets
            WHERE id = 1
        `).get();

        if (!record || !record.access_code_hash) {
            return res.status(403).json({
                message: "열람 코드가 설정되지 않았습니다."
            });
        }

        const valid = await bcrypt.compare(
            code,
            record.access_code_hash
        );

        if (!valid) {
            return res.status(403).json({
                message: "열람 코드가 올바르지 않습니다."
            });
        }

        res.set("Cache-Control", "no-store");

        res.json({
            secrets: JSON.parse(record.content_json).secrets || []
        });
    } catch (error) {
        next(error);
    }
});



/* ========================================
   페이지 기록 저장: 관리자만 가능
======================================== */

app.put("/api/records/:page", requireAdmin, (req, res) => {
    const page = req.params.page;

    if (!allowedPages.has(page)) {
        return res.status(404).json({
            message: "존재하지 않는 기록 페이지입니다."
        });
    }

    if (
        !req.body ||
        !Object.prototype.hasOwnProperty.call(req.body, "content") ||
        !req.body.content ||
        typeof req.body.content !== "object" ||
        Array.isArray(req.body.content)
    ) {
        return res.status(400).json({
            message: "저장할 기록의 형식이 올바르지 않습니다."
        });
    }

    try {
        const content = JSON.parse(JSON.stringify(req.body.content));

        // 생애와 서사는 비밀 기록을 별도 테이블에 저장한다.
        if (page === "story") {
            const hasSecrets = Array.isArray(content.secrets);
            const secrets = hasSecrets ? content.secrets : null;
            const newCode =
                typeof content.accessCode === "string"
                    ? content.accessCode
                    : "";

            delete content.secrets;
            delete content.accessCode;
            delete content.secretsUnlocked;

            let contentJson = JSON.stringify(content);

            if (Buffer.byteLength(contentJson, "utf8") > 4 * 1024 * 1024) {
                return res.status(413).json({
                    message: "공개 기록은 최대 4MB까지 저장할 수 있습니다."
                });
            }

            const oldSecrets = db.prepare(`
                SELECT content_json, access_code_hash
                FROM story_secrets
                WHERE id = 1
            `).get();

            let secretJson = oldSecrets?.content_json || JSON.stringify({ secrets: [] });
            let codeHash = oldSecrets?.access_code_hash || "";

            if (hasSecrets) {
                secretJson = JSON.stringify({ secrets });
            }

            if (newCode) {
                if (Buffer.byteLength(newCode, "utf8") > 72) {
                    return res.status(400).json({
                        message: "열람 코드는 UTF-8 기준 72바이트 이하여야 합니다."
                    });
                }

                codeHash = bcrypt.hashSync(newCode, 12);
            }

            const saveStory = db.transaction(() => {
                db.prepare(`
                    INSERT INTO story_secrets (
                        id, content_json, access_code_hash, updated_at
                    )
                    VALUES (1, ?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(id) DO UPDATE SET
                        content_json = excluded.content_json,
                        access_code_hash = excluded.access_code_hash,
                        updated_at = CURRENT_TIMESTAMP
                `).run(secretJson, codeHash);

                db.prepare(`
                    INSERT INTO records (
                        page_key, content_json, updated_at
                    )
                    VALUES (?, ?, CURRENT_TIMESTAMP)
                    ON CONFLICT(page_key) DO UPDATE SET
                        content_json = excluded.content_json,
                        updated_at = CURRENT_TIMESTAMP
                `).run(page, contentJson);
            });

            saveStory();

            return res.json({
                success: true,
                message: "생애 기록과 비밀 기록이 저장되었습니다."
            });
        }

        const contentJson = JSON.stringify(content);

        if (Buffer.byteLength(contentJson, "utf8") > 4 * 1024 * 1024) {
            return res.status(413).json({
                message: "기록은 페이지당 최대 4MB까지 저장할 수 있습니다."
            });
        }

        db.prepare(`
            INSERT INTO records (
                page_key, content_json, updated_at
            )
            VALUES (?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(page_key) DO UPDATE SET
                content_json = excluded.content_json,
                updated_at = CURRENT_TIMESTAMP
        `).run(page, contentJson);

        res.json({
            success: true,
            message: "기록이 서버에 저장되었습니다."
        });
    } catch (error) {
        console.error("기록 저장 실패:", error);

        res.status(500).json({
            message: "기록 저장 중 오류가 발생했습니다."
        });
    }
});


// 최초 관리자 비밀번호 등록
app.post("/api/auth/setup", setupLimiter, async (req, res, next) => {
    try {
        if (hasAdmin()) {
            return res.status(403).json({
                message: "관리자 설정이 이미 완료되었습니다."
            });
        }

        const password = req.body?.password;
        const confirmPassword = req.body?.confirmPassword;

        if (
            typeof password !== "string" ||
            typeof confirmPassword !== "string"
        ) {
            return res.status(400).json({
                message: "비밀번호를 입력해 주세요."
            });
        }

        if (Buffer.byteLength(password, "utf8") > 72) {
            return res.status(400).json({
                message: "비밀번호는 UTF-8 기준 72바이트 이하여야 합니다."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                message: "비밀번호는 6자 이상으로 설정해 주세요."
            });
        }

        if (password !== confirmPassword) {
            return res.status(400).json({
                message: "두 비밀번호가 일치하지 않습니다."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        // 두 요청이 동시에 최초 설정을 시도해도
        // 관리자 계정은 하나만 생성되도록 처리합니다.
        const createAdmin = db.transaction(() => {
            if (hasAdmin()) {
                return false;
            }

            db.prepare(`
                INSERT INTO admin (id, password_hash)
                VALUES (1, ?)
            `).run(passwordHash);

            return true;
        });

        if (!createAdmin()) {
            return res.status(403).json({
                message: "관리자 설정이 이미 완료되었습니다."
            });
        }

        res.status(201).json({
            message: "관리자 비밀번호가 설정되었습니다. 로그인해 주세요."
        });
    } catch (error) {
        next(error);
    }
});

// 관리자 로그인
app.post("/api/auth/login", loginLimiter, async (req, res, next) => {
    try {
        const password = req.body?.password;

        if (typeof password !== "string") {
            return res.status(400).json({
                message: "비밀번호를 입력해 주세요."
            });
        }

        const admin = db.prepare(
            "SELECT password_hash FROM admin WHERE id = 1"
        ).get();

        if (!admin) {
            return res.status(403).json({
                message: "먼저 최초 관리자 설정을 완료해 주세요."
            });
        }

        const valid = await bcrypt.compare(
            password,
            admin.password_hash
        );

        if (!valid) {
            return res.status(401).json({
                message: "비밀번호가 올바르지 않습니다."
            });
        }

        // 로그인할 때 세션 ID를 새로 발급합니다.
        req.session.regenerate(error => {
            if (error) {
                return next(error);
            }

            req.session.isAdmin = true;

            req.session.save(error => {
                if (error) {
                    return next(error);
                }

                res.json({
                    message: "관리자 로그인에 성공했습니다."
                });
            });
        });
    } catch (error) {
        next(error);
    }
});

// 관리자 로그아웃
app.post("/api/auth/logout", (req, res, next) => {
    req.session.destroy(error => {
        if (error) {
            return next(error);
        }

        res.clearCookie("inmulrok.sid", {
            httpOnly: true,
            sameSite: "strict",
            secure: process.env.NODE_ENV === "production",
            path: "/"
        });

        res.json({ message: "로그아웃되었습니다." });
    });
});

// 관리자 권한 확인용 테스트 API
app.get("/api/admin/check", requireAdmin, (req, res) => {
    res.json({
        authorized: true,
        message: "관리자 인증이 확인되었습니다."
    });
});

// 기존 HTML, CSS, JS 파일 제공
app.use(express.static(ROOT_DIR, {
    index: "index.html",
    dotfiles: "deny"
}));

app.use((error, req, res, next) => {
    console.error(error);
    res.status(500).json({
        message: "서버 오류가 발생했습니다."
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`인물록 서버 실행 완료: 포트 ${PORT}`);
});
