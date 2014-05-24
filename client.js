var _width;  // width of canvas
var _height;  // height of canvas
var ctx;  // canvas context
var canvas;  // canvas element

var roomList;  // DOM element #room-list
var gameBlock;  // DOM element #game

var ws;  // websocket

var NEED_ROOM_PASS;
var fieldMain;  // the main field
var fields;  // the child fields

var PLAYER;  // number of the player
var GAMEID;  // id of the session to interact with server

var EMPTY = 0;  // empty cell
var FIRST = 1;  // first player's cell
var SECOND = 2;  // second player's cell

function clear() {
    ctx.clearRect(0, 0, _width, _height);
}

function line(x0, y0, x1, y1) {
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
}

function circle(x, y, r) {
    ctx.arc(x, y, r, 0, Math.PI * 2);
}


Field = function() {
    this.matrix = [[EMPTY, EMPTY, EMPTY],
                   [EMPTY, EMPTY, EMPTY],
                   [EMPTY, EMPTY, EMPTY]];
}

Field.prototype.at = function(x, y) {
    return this.matrix[x][y];
}

Field.prototype.set = function(x, y, what) {
    this.matrix[x][y] = what;
}

Field.prototype.constructor = Field;


FieldView = function(x, y, wh) {
    this.x = x;
    this.y = y;
    this.width = wh;
    this.height = wh;
    this.field = new Field();
}

FieldView.prototype.containsPoint = function(x, y) {
    return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
}

FieldView.prototype.clickPoint = function(x, y) {
    if (!this.containsPoint(x, y)) {
        return;
    }
    x -= this.x;
    y -= this.y;
    var i = Math.floor(x / (this.width / 3 + 1));
    var j = Math.floor(y / (this.height / 3 + 1));
    Packet.send(new Packet4SetField({cell: [this.i, this.j], field: [i, j]}));
}

FieldView.prototype.drawBounds = function() {
    ctx.strokeStyle = "#404040";
    ctx.rect(x, y, width, height);
    ctx.stroke();
}

FieldView.prototype.draw = function() { }

FieldView.prototype.constructor = FieldView;


function initFields() {
    fieldMain = new FieldView(0, 0, 458);
    fieldMain.draw = function() {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#000000";
        for(var i = 0; i <= 3; i++) {
            line(1 + 152 * i, 0, 1 + 152 * i, 458);
        }
        for(var i = 0; i <= 3; i++) {
            line(0, 1 + 152 * i, 458, 1 + 152 * i);
        }
        ctx.stroke();
        
        for(var i = 0; i < 3; i++) {
            for(var j = 0; j < 3; j++) {
                if (this.field.at(i, j)) {
                    var whatPlayer = this.field.at(i, j);
                    ctx.beginPath();
                    ctx.lineWidth = 2;
                    if (whatPlayer == 1) {
                        line(3 + 152 * i, 3 + 152 * i, 151 + 152 * i, 151 + 152 * i);
                    } else {
                        circle(152 * i + 78, 152 * i + 78, 70);
                    }
                    ctx.stroke();
                }
            }
        }
    };
    
    fields = [];
    for(var i = 0; i < 3; i++) {
        fields.push([]);
        for(var j = 0; j < 3; j++) {
            fields[i][j] = new FieldView(i * 152 + 2, j *  152 + 2, 150);
            fields[i][j].i = i;
            fields[i][j].j = j;
            fields[i][j].draw = function() {
                if (fieldMain.field.at(this.i, this.j)) {
                    return;
                }
                ctx.beginPath();
                ctx.lineWidth = 1;
                ctx.strokeStyle = "#303030";
                for(var i = 1; i <= 2; i++) {
                    line(this.x + this.width / 3 * i, this.y + 2, this.x + this.width / 3 * i, this.y + this.height - 2);
                }
                for(var i = 1; i <= 2; i++) {
                    line(this.x + 2, this.y + this.height / 3 * i + 2, this.x + this.width - 2, this.y + this.height / 3 * i + 2);
                }
                ctx.stroke();
                for(var i = 0; i < 3; i++) {
                    for(var j = 0; j < 3; j++) {
                        if (this.field.at(i, j)) {
                            var whatPlayer = this.field.at(i, j);
                            ctx.beginPath();
                            ctx.lineWidth = 2;
                            console.log(this.i + " " + this.j + "; " + i + " " + j)
                            if (whatPlayer == 1) {
                                line(this.x + 2 + 51 * i, this.y + 2 + 51 * j, this.x + 48 + 51 * i, this.y + 48 + 51 * j)
                                line(this.x + 48 + 51 * i, this.y + 2 + 51 * j, this.x + 2 + 51 * i, this.y + 48 + 51 * j)
                            } else {
                                circle(this.x + i * 51 + 25, this.y + j * 51 + 25, 21);
                            }
                            ctx.stroke();
                        }
                    }
                }
            };
        }
    }
}

function initCanvas() {
    canvas = document.getElementById('canvas');;
    ctx = canvas.getContext("2d");
    _width = canvas.offsetWidth;
    _height = canvas.offsetHeight;
    
    initFields();
    
    canvas.addEventListener("mousemove", mouseMove, false);
    canvas.addEventListener("click", mouseClick, false);
    
    window.setInterval(update, 100);
}


function draw() {
    clear();
    
    fieldMain.draw();
    
    everyField(function(field) {
        field.draw();
    });
}

function mouseMove(event) {
        var mx = event.clientX;
        var my = event.clientY;
        var offsetX = 0;
        var offsetY = 0;
        var element = canvas;
        if (element.offsetParent) {
            do {
                offsetX += element.offsetLeft;
                offsetY += element.offsetTop;
            } while ((element = element.offsetParent));
        }
        mouse.x = mx - canvas.offsetX;
        mouse.y = my - canvas.offsetY;
}

function everyField(func) {
    for(var i = 0; i < 3; i++) {
        for(var j = 0; j < 3; j++) {
            func(fields[i][j]);
        }
    }
}

function mouseClick(event) {
        var mx = event.clientX;
        var my = event.clientY;
        var offsetX = 0;
        var offsetY = 0;
        var element = canvas;
        if (element.offsetParent) {
            do {
                offsetX += element.offsetLeft;
                offsetY += element.offsetTop;
            } while ((element = element.offsetParent));
        }
        mx -= offsetX;
        my -= offsetY;
        everyField(function(field) {
            field.clickPoint(mx, my);
        });
}


Packet = function() { };

Packet.prototype.send_data = function() { return { } };

Packet.prototype.handle = function() { return { } }

Packet.packets = {};

Packet.registerServerPacket = function(klass) {
    Packet.packets[klass.packet_id] = klass
};

Packet.send = function(packet) {
    ws.send(JSON.stringify(
        {
            id: packet.packet_id,
            args: packet.send_data()
        }
    ));
};

Packet.handleServerPacket = function(packet) {
    var id = packet.id;
    var args = packet.args;
    new Packet.packets[id](args).handle();
};


Packet1JoinRoom = function(args) {
    this.room_name = args.room;
    this.password = args.pass;
    this.result = args.result;
    this.number = args.number;
    this.other_name = args.other_name;
    
    this.packet_id = Packet1JoinRoom.packet_id;
};

Packet1JoinRoom.packet_id = 1;

Packet1JoinRoom.prototype = Packet;

Packet1JoinRoom.prototype.handle = function() {
    if (result != "Okay") {
        return;
    }
    
    console.log(this);
    
    PLAYER = this.number;
    if (PLAYER == 2) {
        OTHER_NAME = this.other_name;
        startGame();
    }
};

Packet1JoinRoom.prototype.send_data = function() {
    console.log(2);
    return {
        room: this.room_name,
        pass: this.password
    };
};


Packet2CreateRoom = function(args) {
    this.room_name = args.room;
    this.password = args.pass;
    this.result = args.result;
    this.number = args.number;
    this.other_name = args.other_name;
    
    this.packet_id = Packet2CreateRoom.packet_id;
};

Packet2CreateRoom.packet_id = 2;

Packet2CreateRoom.prototype = Packet;

Packet2CreateRoom.prototype.handle = function() {
    Packet.send(new Packet9RoomList());
};


Packet9RoomList = function(args) {
    this.packet_id = Packet9RoomList.packet_id;
    
    if (args === undefined) {
        return;
    }
    
    this.rooms = args;
    NEED_ROOM_PASS = {};
    for (var i = 0; i < args.length; i++) {
        NEED_ROOM_PASS[args[i].name] = args[i].pass;
    }
};

Packet9RoomList.packet_id = 9;

Packet9RoomList.prototype = Packet.prototype;

Packet9RoomList.prototype.handle = function() {
    text = "";
    for (var i = 0; i < this.rooms.length; i++) {
        text += renderRoomInfo(this.rooms[i]);
    }
    console.log(text);
    roomList.innerHTML = text;
    var buttons = roomList.getElementsByClassName("play");
    for (var i = 0; i < buttons.length; i++) {
        var el = buttons[i];
        el.addEventListener("click", function(event) {
            var name = event.target.parentElement.getElementsByClassName("name")[0].textContent;
            console.log(name);
            if (NEED_ROOM_PASS[name]) {
                return;
            } else {
                console.log(1);
                Packet.send(new Packet1JoinRoom({room: name, pass: ""}));
            }
        }, false);
    }
};

Packet.registerServerPacket(Packet1JoinRoom);
Packet.registerServerPacket(Packet2CreateRoom);
Packet.registerServerPacket(Packet9RoomList);

function renderRoomInfo(roomInfo) {
    return '<div class="room"><div class="name">' + roomInfo.name + '</div class="name"><button class="play">Play</button></div>';
}


function init() {
    roomList = document.getElementById("room-list");
    gameBlock = document.getElementById("game");
    
    ws = new WebSocket("ws://localhost:8181");
    ws.onmessage = function(event) {
        console.log(event.data);
        Packet.handleServerPacket(JSON.parse(event.data));
    };
    ws.onclose = function(event) {
        alert("WEBSOCKET CLOSED");
    };
    ws.onopen = function() {
        Packet.send(new Packet9RoomList());
    };
}

window.addEventListener("DOMContentLoaded", init, false);
