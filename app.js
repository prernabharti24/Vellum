const express = require("express");
const bodyParser = require("body-parser");
const session = require("express-session");
const bcrypt = require("bcrypt");
const db = require("./db");

const app = express();

app.set("view engine", "ejs");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

app.use(
    session({
        secret: "vellum_secret_key",
        resave: false,
        saveUninitialized: false
    })
);

// Authentication Middleware

function isAuthenticated(req, res, next) {
    if (req.session.userId) {
        return next();
    }

    res.redirect("/login");
}

// ================= REGISTER =================

app.get("/register", (req, res) => {
    res.render("register");
});

app.post("/register", async (req, res) => {

    const { username, password } = req.body;

    try {

        const hashedPassword =
            await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO users(username,password) VALUES(?,?)",
            [username, hashedPassword],
            (err) => {

                if (err) {
                    return res.send("Username already exists");
                }

                res.redirect("/login");
            }
        );

    } catch (error) {
        res.send("Registration Error");
    }
});

// ================= LOGIN =================

app.get("/login", (req, res) => {
    res.render("login");
});

app.post("/login", (req, res) => {

    const { username, password } = req.body;

    db.query(
        "SELECT * FROM users WHERE username=?",
        [username],
        async (err, result) => {

            if (err) throw err;

            if (result.length === 0) {
                return res.send("User not found");
            }

            const user = result[0];

            const match = await bcrypt.compare(
                password,
                user.password
            );

            if (!match) {
                return res.send("Incorrect Password");
            }

            req.session.userId = user.id;
            req.session.username = user.username;

            res.redirect("/");
        }
    );
});
// =========Forgot Password===============
app.get("/forgot-password", (req, res) => {
    res.render("forgot-password");
});

app.post("/forgot-password", async (req, res) => {

    const { username, newPassword } = req.body;

    try {

        const hashedPassword =
            await bcrypt.hash(newPassword, 10);

        db.query(
            "UPDATE users SET password=? WHERE username=?",
            [hashedPassword, username],
            (err, result) => {

                if (err) throw err;

                if (result.affectedRows === 0) {
                    return res.send("User not found");
                }

                res.redirect("/login");
            }
        );

    } catch (error) {
        res.send("Password Reset Error");
    }

});

// ================= LOGOUT =================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {
        res.redirect("/login");
    });

});

// ================= HOME + SEARCH =================

app.get("/", isAuthenticated, (req, res) => {

    const search = req.query.search || "";

    if (search) {

        db.query(
            `SELECT * FROM notes
             WHERE user_id = ?
             AND title LIKE ?
             ORDER BY created_at DESC`,
            [
                req.session.userId,
                `%${search}%`
            ],
            (err, result) => {

                if (err) throw err;

                res.render("index", {
                    notes: result,
                    username: req.session.username
                });

            }
        );

    } else {

        db.query(
            `SELECT * FROM notes
             WHERE user_id = ?
             ORDER BY created_at DESC`,
            [req.session.userId],
            (err, result) => {

                if (err) throw err;

                res.render("index", {
                    notes: result,
                    username: req.session.username
                });

            }
        );

    }

});

// ================= ADD NOTE =================

app.post("/add", isAuthenticated, (req, res) => {

    const { title, content } = req.body;

    db.query(
        `INSERT INTO notes
        (title, content, user_id)
        VALUES (?, ?, ?)`,
        [
            title,
            content,
            req.session.userId
        ],
        (err) => {

            if (err) throw err;

            res.redirect("/");
        }
    );

});

// ================= OPEN NOTE =================

app.get("/note/:id", isAuthenticated, (req, res) => {

    db.query(
        `SELECT * FROM notes
         WHERE id = ?
         AND user_id = ?`,
        [
            req.params.id,
            req.session.userId
        ],
        (err, result) => {

            if (err) throw err;

            if (result.length === 0) {
                return res.redirect("/");
            }

            res.render("note", {
                note: result[0]
            });

        }
    );

});

// ================= EDIT PAGE =================

app.get("/edit/:id", isAuthenticated, (req, res) => {

    db.query(
        `SELECT * FROM notes
         WHERE id = ?
         AND user_id = ?`,
        [
            req.params.id,
            req.session.userId
        ],
        (err, result) => {

            if (err) throw err;

            if (result.length === 0) {
                return res.redirect("/");
            }

            res.render("edit", {
                note: result[0]
            });

        }
    );

});

// ================= UPDATE NOTE =================

app.post("/update/:id", isAuthenticated, (req, res) => {

    const { title, content } = req.body;

    db.query(
        `UPDATE notes
         SET title=?, content=?
         WHERE id=?
         AND user_id=?`,
        [
            title,
            content,
            req.params.id,
            req.session.userId
        ],
        (err) => {

            if (err) throw err;

            res.redirect("/");
        }
    );

});

// ================= DELETE NOTE =================

app.get("/delete/:id", isAuthenticated, (req, res) => {

    db.query(
        `DELETE FROM notes
         WHERE id = ?
         AND user_id = ?`,
        [
            req.params.id,
            req.session.userId
        ],
        (err) => {

            if (err) throw err;

            res.redirect("/");
        }
    );

});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});