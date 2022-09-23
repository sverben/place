const express = require("express");
const socket = require("socket.io");
const fs = require("fs");
const config = require("./data/config.json");
const login = require('@djoamersfoort/djo-login-js')

const PORT = process.env.PORT || 3000;

const djo = new login(config.oauth.client_id, config.oauth.client_secret, 'http://localhost:3000/callback', 'user/basic user/names')
const app = express();
const server = app.listen(PORT, () => {
    console.log(`Listening on port ${PORT}`);
});
const io = socket(server);
app.use(express.static("public"));
app.use(djo.session);
io.use(djo.socketSession);

if (!fs.existsSync("data/db.json")) {
    const data = [];
    for (let y = 0; y < config.height; y++) {
        data[y] = [];
        for (let x = 0; x < config.width; x++) {
            data[y][x] = config.colors[config.colors.length - 1];
        }
    }
    fs.writeFileSync("data/db.json", JSON.stringify(data));
}
if (!config.lastVersion) {
    const current = require("./data/db.json")
    const newData = []
    current.forEach(row => {
        const newRow = []
        newData.push(newRow)
        row.forEach(column => {
            newRow.push(config.colors[column])
        })
    })
    config.lastVersion = '1'
    fs.writeFileSync("data/config.json", JSON.stringify(config))
    fs.writeFileSync("data/db.json", JSON.stringify(newData))
}
const db = require("./data/db.json");
const lastAction = new Map();

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/place.html");
})
app.get("/login", djo.requireLogin, (req, res) => {
    req.session.name = req.session.djo.firstName
    res.redirect("/")
})
app.get("/callback", djo.callback)

const editors = {};
io.on("connection", socket => {
    socket.emit("place", {
        "place": db,
        "palette": config.colors
    });
    socket.emit("editors", editors);
    if (socket.request.session.user) {
        if (!lastAction.has(socket.request.session.user)) lastAction.set(socket.request.session.user, 0);

        if (Date.now() - lastAction.get(socket.request.session.user) < config.timer) {
            socket.emit("timer", Math.ceil((config.timer - (Date.now() - lastAction.get(socket.request.session.user)))/ 1000) * 1000);
        }
        if (!editors[socket.request.session.name]) editors[socket.request.session.name] = 0;
        editors[socket.request.session.name]++;

        io.emit("editors", editors);
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
        db[y][x] = config.colors[color];
        lastAction.set(socket.request.session.user, Date.now());

        io.emit("color", { x, y, color: config.colors[color] });
        fs.writeFileSync("data/db.json", JSON.stringify(db));
        socket.emit("timer", config.timer);
    })

    socket.on("disconnect", () => {
        if (!socket.request.session.name) return;
        editors[socket.request.session.name]--;

        io.emit("editors", editors);
    })
})