const socket = io()
const canvas = document.getElementById('canvas')
const login = document.getElementById('login')
const colors = document.getElementById('colors')
const error = document.getElementById('error')
const ctx = canvas.getContext('2d')
const timer = document.getElementById('timer')
canvas.width = window.innerWidth
canvas.height = window.innerHeight
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
})
CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    if (w < 2 * r) r = w / 2
    if (h < 2 * r) r = h / 2
    this.beginPath()
    this.moveTo(x+r, y)
    this.arcTo(x+w, y,   x+w, y+h, r)
    this.arcTo(x+w, y+h, x,   y+h, r)
    this.arcTo(x,   y+h, x,   y,   r)
    this.arcTo(x,   y,   x+w, y,   r)
    this.closePath()
    return this
}
CanvasRenderingContext2D.prototype.triangle = function (x, y, w, h) {
    this.beginPath()
    this.moveTo(x, y)
    this.lineTo(x + w, y)
    this.lineTo(x + w / 2, y + h)
    this.closePath()
    return this
}

class Board {
    constructor(source) {
        this.columns = source
        this.scale = Math.floor(window.innerWidth / this.columns.length)
        this.position = {
            x: Math.round(window.innerWidth / 2 - (this.columns.length * this.scale / 2)),
            y: Math.round(window.innerHeight / 2 - (this.columns[0].length * this.scale / 2))
        }
        this.holding = false
        this.moving = false
        this.selected = '#ffffff'
        this.recentActions = []
        this.timer = null
        this.started = null

        canvas.addEventListener('mousemove', e => {
            if (!this.holding) return

            this.moving = true
            this.position['x'] += e.movementX
            this.position['y'] += e.movementY
        })
        canvas.addEventListener('click', e => {
            if (this.holding)
                this.holding = false
            if (this.moving)
                return this.moving = false

            const pos = {
                x: Math.floor((e.offsetX - this.position.x) / this.scale),
                y: Math.floor((e.offsetY - this.position.y) / this.scale)
            }
            if (pos.x < 0 || pos.x >= this.columns.length)
                return
            if (pos.y < 0 || pos.y >= this.columns[0].length)
                return
            socket.emit('color', { x: pos.x, y: pos.y, color: this.selected })
        })
        canvas.addEventListener('mousedown', () => {
            this.holding = true
        })
        canvas.addEventListener('wheel', e => {
            const x = Math.round((this.position.x - e.offsetX) / this.scale)
            const y = Math.round((this.position.y - e.offsetY) / this.scale)
            if (e.deltaY < 0) {
                this.scale += 3
                this.position.x += x*3
                this.position.y += y*3
            } else {
                this.scale -= 3
                this.position.x -= x*3
                this.position.y -= y*3
            }
            if (this.scale < 3) this.scale = 3
        })
        this.draw()
    }

    getPos = (x, y) => {
        return { x: this.position.x + x * this.scale, y: this.position.y + y * this.scale }
    }

    draw = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.fillStyle = '#22222c'
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        this.columns.forEach((column, x) => {
            column.forEach((color, y) => {
                ctx.fillStyle = color
                const pos = this.getPos(x, y)
                ctx.fillRect(pos.x, pos.y, this.scale, this.scale)
            })
        })
        this.recentActions.forEach(action => {
            if (new Date().getTime() - action.time > 3000)
                return

            ctx.strokeStyle = '#1a59de'
            ctx.fillStyle = '#1a59de'

            const { width } = ctx.measureText(action.name)
            const pos = this.getPos(action.x, action.y)
            ctx.strokeRect(pos.x, pos.y, this.scale, this.scale)

            const x = pos.x + this.scale / 2 - width / 2
            const y = pos.y - 20
            ctx.roundRect(x - 5, y, width + 10, 13, 3).fill()
            ctx.triangle(pos.x + this.scale / 2 - 5, y + 13, 10, 5).fill()
            ctx.fillStyle = '#ffffff'
            ctx.fillText(action.name, x, y + 10)
        })
        this.recentActions = this.recentActions.filter(action => {
            return new Date().getTime() - action.time <= 3000
        })
        if (this.started && new Date().getTime() - this.started < this.timer) {
            timer.innerText = `${Math.ceil((this.timer - (new Date().getTime() - this.started)) / 1000)}`
        } else {
            timer.innerText = ''
        }
        requestAnimationFrame(this.draw)
    }
}
let board
socket.on('board', source => {
    board = new Board(source)
})
socket.on('color', ({ x, y, color, name }) => {
    board.columns[x][y] = color
    board.recentActions.push({
        stage: 0,
        x,
        y,
        name,
        color,
        time: new Date().getTime()
    })
})
socket.on('show_login_btn', () => {
    login.style.display = 'block'
})
let selectedE = null
socket.on('colors', codes => {
    codes.forEach(color => {
        const e = document.createElement('div')
        e.classList.add('color')
        e.style.backgroundColor = color
        e.addEventListener('click', () => {
            if (selectedE)
                selectedE.classList.remove('selected')
            e.classList.add('selected')
            selectedE = e
            board.selected = color
        })

        colors.append(e)
    })
})
socket.on('error', err => {
    error.innerText = err
    error.style.display = 'block'
    setTimeout(() => {
        error.style.display = 'none'
    }, 2000)
})
socket.on('timer', time => {
    board.timer = time.timer
    board.started = time.started
})