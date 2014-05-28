var _width;  // width of canvas
var _height;  // height of canvas
var ctx;  // canvas context
var canvas;  // canvas element

var menuBlock;  // DOM element #menu
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

var NAME = "Неизвестный";  // player's name
var OTHER_NAME = "";  // other player's name

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
    Packet.send(new Packet4SetField({cell: [i, j], field: [this.i, this.j]}));
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
                        line(3 + 152 * i, 3 + 152 * j, 151 + 152 * i, 151 + 152 * j);
                        line(3 + 152 * i, 151 + 152 * j, 151 + 152 * i, 3 + 152 * j);
                    } else {
                        circle(152 * i + 78, 152 * j + 78, 70);
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
    
    canvas.addEventListener("click", mouseClick, false);
    
    window.setInterval(update, 100);
}

function update() {
    draw();
}

function draw() {
    clear();
    
    fieldMain.draw();
    
    everyField(function(field) {
        field.draw();
    });
}

function everyField(func) {
    for(var i = 0; i < 3; i++) {
        for(var j = 0; j < 3; j++) {
            func(fields[i][j]);
        }
    }
}


NOTICE_TIMEOUT1 = -1;
NOTICE_TIMEOUT2 = -1;

function notify(text, time) {
    time = time || 1400;
    
    clearTimeout(NOTICE_TIMEOUT1);
    clearTimeout(NOTICE_TIMEOUT2);
    var elementNotify = document.getElementById("notice");
    elementNotify.style.transition = "none";
    elementNotify.classList.remove("pshol");
    elementNotify.style.transition = "all " + ((5 / 7) * time) / 1000 +"s ease";
    elementNotify.innerHTML = text;
    elementNotify.style.display = "block";
    NOTICE_TIMEOUT1 = setTimeout(function() {
        elementNotify.classList.add("pshol");  // pshol - пошел, hides element with animation, it takes 1 second
        NOTICE_TIMEOUT2 = setTimeout(function() {
            elementNotify.style.display = "none";
            elementNotify.classList.remove("pshol");
        }, (5 / 7) * time);
    }, (2 / 7) * time);
}


function showReplayPanel() {
    document.getElementById("replay-panel").classList.add("show-replay-panel");
    document.getElementById("page-darker").classList.add("show-replay-panel");
}

function hideReplayPanel() {
    document.getElementById("replay-panel").classList.remove("show-replay-panel");
    document.getElementById("page-darker").classList.remove("show-replay-panel");
}


function mouseClick(event) {
    var rect = canvas.getBoundingClientRect();
    
    mx = event.clientX - rect.left;
    my = event.clientY - rect.top;
    everyField(function(field) {
        field.clickPoint(mx, my);
    });
}


Packet = function() { };

Packet.prototype.send_data = function() { return { } };

Packet.prototype.handle = function() { return { } }

Packet.packets = {};

Packet.registerServerPacket = function(klass) {
    Packet.packets[klass.packet_id] = klass;
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
    if(id == 1) console.log(new Packet.packets[id](args).handle);
    new Packet.packets[id](args).handle();
};


Packet1JoinRoom = function(args) {
    this.packet_id = 1;
    
    this.room_name = args.room;
    this.password = args.pass;
    this.result = args.result;
    this.number = args.number;
};

Packet1JoinRoom.packet_id = 1;

Packet1JoinRoom.prototype = new Packet();

Packet1JoinRoom.prototype.handle = function() {    
    if (this.result != "Okay") {
        return;
    }
    
    menuBlock.style.display = "none";
    gameBlock.style.display = "block";
    initCanvas();
    
    PLAYER = this.number;
};

Packet1JoinRoom.prototype.send_data = function() {
    return {
        room: this.room_name,
        pass: this.password,
        name: NAME
    };
};

Packet1JoinRoom.prototype.constructor = Packet1JoinRoom;


Packet2CreateRoom = function(args) {
    this.packet_id = 2;
    
    this.room_name = args.room;
    this.password = args.pass;
    this.result = args.result;
    this.number = args.number;
    this.other_name = args.other_name;
};

Packet2CreateRoom.packet_id = 2;

Packet2CreateRoom.prototype = new Packet();

Packet2CreateRoom.prototype.send_data = function() {
    return {
        room: this.room_name,
        pass: this.password
    };
};

Packet2CreateRoom.prototype.constructor = Packet2CreateRoom;


Packet3GameStarted = function(args) {
    this.packet_id = 3;
    
    OTHER_NAME = args.name;
};

Packet3GameStarted.packet_id = 3;

Packet3GameStarted.prototype = new Packet();

Packet3GameStarted.prototype.handle = function() {
    notify("Игра началась!");
    document.getElementById("other-player-name").textContent = "Вашего соперника зовут " + OTHER_NAME;
};

Packet3GameStarted.prototype.constructor = Packet3GameStarted;


Packet4SetField = function(args) {
    this.packet_id = 4;
    
    this.cell = args.cell;
    this.field = args.field;
    this.player = args.player;
    this.data = args.data;
    this.type = args.type;
};

Packet4SetField.packet_id = 4;

Packet4SetField.prototype = new Packet();

Packet4SetField.prototype.handle = function() {
    switch(this.type) {
        case 1:
            fields[this.data[0][0]][this.data[0][1]].field.set(this.data[1][0], this.data[1][1], this.player);
            break;
        case 2:
            fieldMain.field.set(this.data[0][0], this.data[0][1], this.player);
            break;
        case 3:
            fieldMain.field.set(this.data[0][0], this.data[0][1], this.player);
            if (this.player == PLAYER) {
                notify("Вы выиграли! :)");
            } else {
                notify("Вы проиграли! :(");
            }
            showReplayPanel();
            break;
    }
};

Packet4SetField.prototype.send_data = function() {
    return {
        cell: this.cell,
        field: this.field
    };
};

Packet4SetField.prototype.constructor = Packet4SetField;


Packet5ChatMessage = function(args) {
    this.packet_id = 5;
    
    this.msg = args.msg;
    this.who_name = args.who_name;
    this.who_number = args.who_number;
};

Packet5ChatMessage.packet_id = 5;

Packet5ChatMessage.prototype = new Packet();

Packet5ChatMessage.prototype.handle = function() {
    var elementMsgs = document.getElementById("msgs");
    var append = "";
    if (this.who_number == PLAYER) {
        append = '<div class="msg"><div class="msg_r">' + this.msg + '</div><div class="clear"></div></div>';
    } else {
        append = '<div class="msg"><div class="msg_l">' + this.msg + '</div><div class="clear"></div></div>';;
    }
    elementMsgs.innerHTML += append;
};

Packet5ChatMessage.prototype.send_data = function() {
    return {
        msg: this.msg
    };
};

Packet5ChatMessage.prototype.constructor = Packet5ChatMessage;


Packet6GameBreak = function(args) {
    this.packet_id = 6;
    
    this.reason = args.reason;
};

Packet6GameBreak.packet_id = 6;

Packet6GameBreak.prototype = new Packet();

Packet6GameBreak.prototype.handle = function() {
    switch(this.reason) {
        case "UUnactive":
            notify("Вы неактивны! Игра прекращена.");
            setTimeout(function() {
                location.reload();
            }, 1400);
            break;
        case "OtherUnactive":
            notify("Другой игрок неактивен! Игра прекращена.");
            setTimeout(function() {
                location.reload();
            }, 1400);
            break;
        case "OtherPlayerDisconnected":
            notify("Другой игрок отключился! Игра прекращена.");
            setTimeout(function() {
                location.reload();
            }, 1400);
            break;
    }
};

Packet6GameBreak.prototype.constructor = Packet6GameBreak;


Packet7Replay = function(args) {
    this.packet_id = 7;
};

Packet7Replay.packet_id = 7;

Packet7Replay.prototype = new Packet();

Packet7Replay.prototype.handle = function() {
    initFields();
    hideReplayPanel();
    notify("Начата новая игра!");
};

Packet7Replay.prototype.constructor = Packet7Replay;


Packet8OtherWantsReplay = function(args) {
    this.packet_id = 8;
};

Packet8OtherWantsReplay.packet_id = 8;

Packet8OtherWantsReplay.prototype = new Packet();

Packet8OtherWantsReplay.handle = function() {
    notify("Другой игрок хочет сыграть еще раз.", 3000);
};

Packet8OtherWantsReplay.prototype.constructor = Packet8OtherWantsReplay;


Packet9RoomList = function(args) {
    this.packet_id = 9;
    
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

Packet9RoomList.prototype = new Packet();

Packet9RoomList.prototype.handle = function() {
    if (this.rooms == undefined || this.rooms.length == 0) {
        roomList.innerHTML = "— — —";
        return;
    }
    
    text = "";
    for (var i = 0; i < this.rooms.length; i++) {
        text += renderRoomInfo(this.rooms[i]);
    }
    roomList.innerHTML = text;
    var buttons = roomList.getElementsByClassName("play");
    for (var i = 0; i < buttons.length; i++) {
        var el = buttons[i];
        el.addEventListener("click", function(event) {
            var name = event.target.parentElement.getElementsByClassName("name")[0].textContent;
            if (NEED_ROOM_PASS[name]) {
                return;
            } else {
                Packet.send(new Packet1JoinRoom({room: name, pass: ""}));
            }
        }, false);
    }
};

Packet9RoomList.prototype.constructor = Packet9RoomList;


Packet.registerServerPacket(Packet1JoinRoom);
Packet.registerServerPacket(Packet2CreateRoom);
Packet.registerServerPacket(Packet3GameStarted);
Packet.registerServerPacket(Packet4SetField);
Packet.registerServerPacket(Packet5ChatMessage);
Packet.registerServerPacket(Packet6GameBreak);
Packet.registerServerPacket(Packet7Replay);
Packet.registerServerPacket(Packet8OtherWantsReplay);
Packet.registerServerPacket(Packet9RoomList);


function renderRoomInfo(roomInfo) {
    return '<div class="room"><div class="name">' + roomInfo.name + '</div class="name"><button class="play">Play</button></div>';
}


function init() {
    el = document.getElementById("create-room-pass");
    el.addEventListener("mouseover", function() {
        document.getElementById("about-password").classList.add("show-about");
    }, false);
    el.addEventListener("mouseout", function() {
        document.getElementById("about-password").classList.remove("show-about");
    }, false);
    
    document.getElementById("message-send").addEventListener("click", function() {
        var elementText = document.getElementById("message-text");
        Packet.send(new Packet5ChatMessage({msg: elementText.value}));
        elementText.value = "";
    }, false);
    
    document.getElementById("replay-button").addEventListener("click", function() {
        Packet.send(new Packet7Replay());
        notify("Ожидание другого игрока...", 2000);
    }, false);
    
    document.getElementById("message-text").addEventListener("keydown", function(event) {
        if (event.keyCode == 13 && !event.shiftKey) {
            var elementText = document.getElementById("message-text");
            if (elementText.value.trim() == "") {
                return;
            }
            Packet.send(new Packet5ChatMessage({msg: elementText.value}));
            elementText.value = "";
            event.preventDefault();
        }
    }, false);
    
    document.getElementById("player-name").addEventListener("input", function(event) {
        NAME = event.target.value;
    }, false);
    
    document.getElementById("create-button").addEventListener("click", function() {
        if (ws.OPEN) {
            Packet.send(new Packet2CreateRoom({
                                                room: document.getElementById("create-room-name").value,
                                                pass: document.getElementById("create-room-pass").value
                                            }));
        }
    }, false);
    
    menuBlock = document.getElementById("menu")
    roomList = document.getElementById("room-list");
    gameBlock = document.getElementById("game");
    
    ws = new WebSocket("ws://localhost:8181");
    ws.onmessage = function(event) {
        console.log(event.data);
        Packet.handleServerPacket(JSON.parse(event.data));
    };
    ws.onclose = function(event) {
        notify("WEBSOCKET CLOSED");
    };
    ws.onopen = function() {
        Packet.send(new Packet9RoomList());
    };
}

window.addEventListener("DOMContentLoaded", init, false);
