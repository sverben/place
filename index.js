import express from 'express'
import { Server } from 'socket.io'
import fs from 'fs'
import login from '@djoamersfoort/djo-login-js'

if (!fs.existsSync('./data/config.json')) {
    console.log('Create a config in the path ./data/config.json')
    process.exit()
}
const config = JSON.parse(fs.readFileSync('./data/config.json').toString())

const app = express()
const djo = new login(config.oauth.client_id, config.oauth.client_secret, config.oauth.redirect, 'user/basic user/names')
app.use(express.static('public'))
const server = app.listen(3000)
const io = new Server(server)
io.use(djo.socketSession)

app.get('/login', djo.requireLogin, (req, res) => {
    res.redirect('/')
})
app.get('/callback', djo.callback)

class Board {
    constructor(file, width, height) {
        if (fs.existsSync(file))
            this.columns = JSON.parse(fs.readFileSync(file).toString())
        else {
            this.columns = []
            for (let x = 0; x < width; x++) {
                this.columns[x] = []
                for (let y = 0; y < height; y++) {
                    this.columns[x][y] = "#000000"
                }
            }
        }
        this.file = file
        this.actions = new Map()
    }

    set = ({ x, y }, color, user = null) => {
        if (!this.columns[x]) return 'Out of bounds!'
        if (!this.columns[x][y]) return 'Out of bounds!'

        if (user) {
            if (new Date().getTime() - this.actions.get(user) < config.timer) {
                return `Wait ${Math.ceil((config.timer - (new Date().getTime() - this.actions.get(user))) / 1000)} seconds!`
            }
            this.actions.set(user, new Date().getTime())
        }

        this.columns[x][y] = color
        this.save()
    }

    save = () => fs.writeFileSync(this.file, JSON.stringify(this.columns))
}
const board = new Board('./data/canvas.json', config.width, config.height)

io.on('connection', socket => {
    socket.emit('board', board.columns)
    socket.emit('colors', config.colors)
    if (!socket.request.session.user)
        socket.emit('show_login_btn')
    else
        socket.emit('timer', { timer: config.timer, started: board.actions.get(socket.request.session.djo.id) })

    socket.on('color', ({ x, y, color }) => {
        if (!socket.request.session.user)
            return socket.emit('error', 'Not signed in!')
        if (!config.colors.includes(color))
            return socket.emit('error', 'Invalid color!')

        const error = board.set({ x, y }, color, socket.request.session.djo.id)
        if (!error) {
            io.emit('color', { x, y, color, name: socket.request.session.djo.firstName })
            socket.emit('timer', { timer: config.timer, started: new Date().getTime() })
        } else {
            socket.emit('error', error)
        }
    })
})