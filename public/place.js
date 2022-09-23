const socket = io();
const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const login = document.querySelector(".login");
let click;

let content = null;
let position = null;
let tileWidth = null;
let timer = null;
let palette;
function drawPlace() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.fillStyle = "rgb(124,124,124)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (!tileWidth) {
        tileWidth = Math.floor(window.innerWidth / content[0].length);
    }
    if (!position) {
        position = {
            x: Math.round((canvas.width - (tileWidth * content[0].length)) / 2),
            y: Math.round((canvas.height - (tileWidth * content.length)) / 2)
        }
    }

    for (let y = 0; y < content.length; y++) {
        for (let x = 0; x < content[y].length; x++) {
            const code = content[y][x];
            ctx.fillStyle = `rgb(${code[0]}, ${code[1]}, ${code[2]})`;
            ctx.fillRect(x * tileWidth + position.x, y * tileWidth + position.y, tileWidth, tileWidth);
        }
    }

    if (!click) return;
    ctx.strokeStyle = "rgb(124,124,124)";
    ctx.strokeRect(click[0] * tileWidth + position.x, click[1] * tileWidth + position.y, tileWidth, tileWidth);
}

const picker = document.querySelector(".picker");
const timerEl = document.querySelector(".timer");
const message = document.querySelector(".message");
socket.on("showLogin", () => {
    login.style.display = "block";
    login.addEventListener("click", () => {
        window.location.assign("/login");
    })
})
socket.on("place", place => {
    palette = place.palette;
    for (let id in palette) {
        const color = palette[id];
        const el = document.createElement("div");
        el.classList.add("color");
        el.style.backgroundColor = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
        el.addEventListener("click", () => {
            if (timer) {
                timerEl.style.color = "red";
                setTimeout(() => {
                    timerEl.style.color = "white";
                }, 1000);
                error(`Wait ${timer} seconds before placing another pixel!`);
                return;
            }
            socket.emit("color", {
                x: click[0],
                y: click[1],
                color: id
            })
            click = null;
            picker.style.display = "none";
            drawPlace();
        });

        picker.append(el);
    }

    content = place.place;

    drawPlace();
})
socket.on("color", data => {
    content[data.y][data.x] = data.color;
    drawPlace();
})
socket.on("error", err => {
    error(err);
})
socket.on("timer", time => {
    timer = time / 1000;
    timerEl.style.display = "block";
    timerEl.innerText = timer;
    const interval = setInterval(() => {
        timer--;
        if (timer === 0) {
            timerEl.style.display = "none";
            timer = null;
            clearInterval(interval);
        }
        timerEl.innerText = timer;
    }, 1000);
})
let down = false;
let moving;
let mousePos;
canvas.addEventListener("click", e => {
    if (moving) {
        moving = false;
        return;
    }
    const x = Math.floor((e.offsetX - position.x) / tileWidth);
    const y = Math.floor((e.offsetY - position.y) / tileWidth);
    click = [x, y];
    picker.style.display = "grid";
    drawPlace();
})
window.addEventListener("resize", () => {
    tileWidth = null;
    position = null;
    drawPlace();
})


canvas.addEventListener("mousedown", ev => {
    down = true;
    mousePos = [ev.layerX, ev.layerY];
})
canvas.addEventListener("mouseup", ev => {
    down = false;
    canvas.style.cursor = "unset";
})
let pointer = [0, 0];
canvas.addEventListener("mousemove", ev => {
    if (!down) return;
    if (!moving) moving = true;
    canvas.style.cursor = "grabbing";

    position.x -= Math.round((mousePos[0] - ev.layerX));
    position.y -= Math.round((mousePos[1] - ev.layerY));
    mousePos = [ev.layerX, ev.layerY];
    pointer[0] = ev.layerX;
    pointer[1] = ev.layerY;
    drawPlace();
})
canvas.addEventListener("wheel", e => {
    const x = (e.offsetX - position.x) / tileWidth;
    const y = (e.offsetY - position.y) / tileWidth;
    let tileX = x * tileWidth + position.x;
    let tileY = y * tileWidth + position.y;
    if (e.deltaY < 0) {
        tileWidth += 3;
    } else {
        tileWidth -= 3;
    }
    if (tileWidth < 3) tileWidth = 3;
    position.x -= Math.round(x * tileWidth + position.x - tileX);
    position.y -= Math.round(y * tileWidth + position.y - tileY);

    drawPlace();
})

function error(err) {
    message.innerText = err;
    message.style.top = "75px";
    setTimeout(() => {
        message.style.top = "-50px";
    }, 3000);
}

socket.on("editors", editors => {
    const editorsEl = document.getElementById("list");
    editorsEl.innerHTML = "";

    for (let editor in editors) {
        if (editors[editor] === 0) continue;
        const el = document.createElement("div");

        el.innerText = editor;
        editorsEl.append(el);
    }
})