const express = require("express");
const socket = require("socket.io");
const fs = require("fs");
const config = require("./data/config.json");
const { AuthorizationCode } = require("simple-oauth2");
const session = require("express-session");
const axios = require("axios");

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static("public"));
const sessions = session({
    secret: config.session_key,
    saveUninitialized:true,
    cookie: { maxAge: 24 * 60 * 60 * 10000 },
    resave: false
})
app.use(sessions);
const client = new AuthorizationCode(config.oauth);
const server = app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
const io = socket(server);
io.use(function(socket, next) {
    sessions(socket.request, socket.request.res || {}, next);
});
if (!fs.existsSync("data/db.json")) {
    const data = [];
    for (let y = 0; y < config.height; y++) {
        data[y] = [];
        for (let x = 0; x < config.width; x++) {
            data[y][x] = config.colors.length - 1;
        }
    }
  fs.writeFileSync("data/db.json", JSON.stringify(data));
}
const db = require("./data/db.json");
const lastAction = new Map();

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/place.html");
})
app.get("/login", (req, res) => {
    if (typeof req.session.user === "undefined") {
        const authorizationUri = client.authorizeURL({
            redirect_uri: `${config.base_uri}/callback`,
            scope: "user/basic",
            state: req.query.state
        });

        return res.redirect(authorizationUri);
    } else {
        return res.redirect("/");
    }
})
app.get("/callback", async (req, res) => {
    if (typeof req.query.code === "undefined") return res.send("No");

    const tokenParams = {
        code: req.query.code,
        redirect_uri: `${config.base_uri}/callback`,
        scope: "user/basic",
    };

    try {
        const tokenDetails = await client.getToken(tokenParams);
        const accessToken = tokenDetails.token.access_token;

        axios.get("https://leden.djoamersfoort.nl/api/v1/member/details", {
            headers: {
                Authorization: `Bearer ${accessToken}`
            }
        }) .then(_res => {
            req.session.user = _res.data.id;

            return res.redirect("/");
        })
            .catch(err => {
                return res.send("An error occurred while trying to fetch user data!");
            })
    } catch (e) {
        return res.send("An error occurred while handling login process!");
    }
})

io.on("connection", socket => {
    socket.emit("place", {
        "place": db,
        "palette": config.colors
    });
    if (socket.request.session.user) {
        if (!lastAction.has(socket.request.session.user)) lastAction.set(socket.request.session.user, 0);

        if (Date.now() - lastAction.get(socket.request.session.user) < config.timer) {
            socket.emit("timer", Math.ceil((config.timer - (Date.now() - lastAction.get(socket.request.session.user)))/ 1000) * 1000);
        }
    } else {
        socket.emit("showLogin");
    }


    socket.on("color", ({x, y, color}) => {
        if (!socket.request.session.user) return socket.emit("error", "You aren't logged in!");
        if (typeof x === "undefined" || typeof y === "undefined" || typeof color === "undefined") {
            return socket.emit("error", "Invalid arguments");
        }
        if (!(x < config.width && y < config.height && x >= 0 && y >= 0)) return socket.emit("error", "Out of bounds");
        if (typeof config.colors[color] === "undefined") return socket.emit("error", "Invalid color");
        if (Date.now() - lastAction.get(socket.request.session.user) < config.timer) return socket.emit("error", "You can't change the color too often!");
        db[y][x] = color;
        lastAction.set(socket.request.session.user, Date.now());

        io.emit("color", {x, y, color});
        fs.writeFileSync("data/db.json", JSON.stringify(db));
        socket.emit("timer", config.timer);
    })
})