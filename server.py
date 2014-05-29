import asyncio
import websockets
import json
import time


class Player():
    players = {}
    next_id = 0

    @staticmethod
    def by_id(player_id):
        return Player.players[player_id]

    @staticmethod
    def remove(player):
        del Player.players[player.id]

    def __init__(self, ws):
        self.id = Player.next_id
        self.socket = ws
        self.room = None
        self.number = 0
        self.name = "Неизвестный"
        self.wants_replay = False
        self.last_activity = time.time()
        self.disconnect = False
        Player.players[self.id] = self
        Player.next_id += 1

    def join(self, room):
        self.room = room
        self.number = self.room.add_player(self)


class Field():
    def __init__(self):
        self.matrix = [[0, 0, 0] for i in range(3)]
        self.win_event = lambda who, how: None

    def at(self, x, y):
        return self.matrix[x][y]

    def set(self, x, y, pl):
        if self.at(x, y) == 0:
            self.matrix[x][y] = pl
            return True
        else:
            return False

    def check_for_win(self):
        how = []

        for x in range(0, 3):
            if self.at(x, 0) == self.at(x, 1) == self.at(x, 2) != 0:
                for y in range(0, 3):
                    how.append((x, y))
                return how

        for y in range(0, 3):
            if self.at(0, y) == self.at(1, y) == self.at(2, y) != 0:
                for x in range(0, 3):
                    how.append((x, y))
                return how

        if self.at(0, 0) == self.at(1, 1) == self.at(2, 2) != 0:
            return [(0, 0), (1, 1), (2, 2)]

        if self.at(2, 0) == self.at(1, 1) == self.at(0, 2) != 0:
            return [(2, 0), (1, 1), (0, 2)]

        return False


class Room():
    rooms = {}

    @staticmethod
    def by_name(name):
        if name in Room.rooms:
            return Room.rooms[name]
        else:
            return None

    @staticmethod
    def remove(room):
        del Room.rooms[room.name]

    def __init__(self, name, password):
        self.name = name
        self.first_player = None
        self.second_player = None
        self.fields = [[Field(), Field(), Field()] for i in range(3)]
        self.main_field = Field()
        self.who_goes = 1
        self.started = False
        self.ended = False
        self.password = password
        Room.rooms[name] = self

        for player_id in Player.players:
            Packet.send(Packet9RoomsList({}, Player.players[player_id]))

    def add_player(self, player):
        if self.first_player is None:
            self.first_player = player
            return 1
        else:
            self.second_player = player
            Packet.send(Packet3GameStarted({}, self.first_player))
            Packet.send(Packet3GameStarted({}, player))
            self.started = True
            for player_id in Player.players:
                Packet.send(Packet9RoomsList({}, Player.players[player_id]))
            return 2

    def other(self, player):
        if player == self.first_player:
            return self.second_player
        else:
            return self.first_player

    def set(self, field_x, field_y, x, y, pl):
        if not self.started:
            return [0]
        if self.ended:
            return [0]
        if self.who_goes != pl.number:
            return [0]
        if self.main_field.at(field_x, field_y) != 0:
            return [0]
        if not self.fields[field_x][field_y].set(x, y, pl.number):
            return [0]

        if self.who_goes == 1:
            self.who_goes = 2
        else:
            self.who_goes = 1

        win = self.fields[field_x][field_y].check_for_win()
        if not win:
            return [1]
        else:
            self.main_field.set(field_x, field_y, pl.number)
            win_main = self.main_field.check_for_win()
            if win_main:
                self.ended = True
                return [3, win, win_main]
            else:
                return [2, win]

    def wants_replay(self, player):
        player.wants_replay = True
        if not (self.first_player.wants_replay and self.second_player.wants_replay):
            if player == self.first_player:
                Packet.send(Packet8OtherWantsReplay({}, self.second_player))
            else:
                Packet.send(Packet8OtherWantsReplay({}, self.first_player))
        else:
            Packet.send(Packet7Replay({}, self.first_player))
            Packet.send(Packet7Replay({}, self.second_player))
            self.fields = [[Field(), Field(), Field()] for i in range(3)]
            self.main_field = Field()
            self.ended = False
            self.first_player.wants_replay = False
            self.second_player.wants_replay = False
            self.who_goes = 1


class UnregisteredPacketError(Exception):
    def __init__(self, packet):
        self.packet = packet

    def __str__(self):
        return "Packet " + repr(self.packet) + " isn't registered!"


class Packet():
    client_packets = {}

    @staticmethod
    def handle_client_packet(packet_json, player):
        if packet_json["id"] in Packet.client_packets:
            Packet.client_packets[packet_json["id"]](packet_json["args"], player).handle()
        else:
            raise UnregisteredPacketError(packet_json["id"])

    @staticmethod
    def register_client_packet(klass):
        Packet.client_packets[klass.packet_id] = klass

    @staticmethod
    def packetize(packet, data):
        return json.dumps({
            "id": packet.__class__.packet_id,
            "args": data
        })

    @staticmethod
    def send(packet):
        asyncio.async(Packet.coroutine_send_packet(packet))

    @staticmethod
    @asyncio.coroutine
    def coroutine_send_packet(packet):
        if not packet.player.socket.open:
            return
        send_data = Packet.packetize(packet, packet.send_data())
        yield from packet.player.socket.send(send_data)

    def send_data(self):
        pass

    def handle(self):
        pass


class Packet0Test(Packet):
    packet_id = 0

    def __init__(self, args, player):
        self.text = args["text"]
        self.player = player

    def handle(self):
        Packet.send(self)

    def send_data(self):
        return {
            "text": self.text
        }


class Packet1JoinRoom(Packet):
    packet_id = 1

    def __init__(self, args, player):
        self.room_name = args["room"]
        self.name = args["name"]
        self.password = args["pass"]
        self.result = ""
        self.player = player

    def handle(self):
        if self.player.room is not None:
            return

        self.player.name = self.name

        room = Room.by_name(self.room_name)
        if room is None:
            self.result = "RoomDoesNotExist"
        elif not room.started:
            if room.password == self.password:
                self.player.join(room)

                self.result = "Okay"
            else:
                self.result = "WrongPassword"
        else:
            self.result = "CanNotJoinRoom"

        Packet.send(self)

    def send_data(self):
        return {
            "result": self.result,
            "number": self.player.number
        }


class Packet2CreateRoom(Packet):
    packet_id = 2

    def __init__(self, args, player):
        self.room_name = args["room"]
        if "pass" in args:
            self.password = args["pass"]
        else:
            self.password = ""
        self.result = ""
        self.player = player

    def handle(self):
        if self.player.room is not None:
            return

        if Room.by_name(self.room_name) is not None:
            self.result = "RoomNameAlreadyUsed"
        else:
            Room(self.room_name, self.password)
            self.result = "Okay"

        Packet.send(self)

    def send_data(self):
        return {
            "result": self.result
        }


class Packet3GameStarted(Packet):
    packet_id = 3

    def __init__(self, args, player):
        self.player = player

    def send_data(self):
        return {
            "name": self.player.room.other(self.player).name
        }


class Packet4SetField(Packet):
    packet_id = 4

    def __init__(self, args, player):
        self.cell = args["cell"]  # (x, y)
        self.field = args["field"]  # (x, y)
        self.player = player
        self.who_number = player.number
        self.type = None
        self.data = None

    def handle(self):
        if self.player.room is None:
            return

        result = self.player.room.set(self.field[0], self.field[1], self.cell[0], self.cell[1], self.player)
        self.type = result[0]

        if self.type == 0:
            return
        elif self.type == 1:
            self.data = ((self.field[0], self.field[1]), (self.cell[0], self.cell[1]))
        elif self.type == 2:
            self.data = ((self.field[0], self.field[1]), (self.cell[0], self.cell[1]), result[1])
        else:
            self.data = ((self.field[0], self.field[1]), (self.cell[0], self.cell[1]), result[1], result[2])

        Packet.send(self)

        pck_to_other = Packet4SetField({"cell": self.cell, "field": self.field}, self.player.room.other(self.player))
        pck_to_other.type = self.type
        pck_to_other.data = self.data
        pck_to_other.who_number = self.who_number
        Packet.send(pck_to_other)

    def send_data(self):
        return {
            "type": self.type,
            "data": self.data,
            "player": self.who_number
        }


class Packet5ChatMessage(Packet):
    packet_id = 5

    def __init__(self, args, player):
        self.message = args["msg"]
        self.player = player
        self.who_name = player.name
        self.who_number = player.number

    def handle(self):
        if self.player.room is None:
            return

        if not self.player.room.started:
            return

        Packet.send(self)
        pck = Packet5ChatMessage({"msg": self.message}, self.player.room.other(self.player))
        pck.who_number = self.who_number
        pck.who_name = self.who_name
        Packet.send(pck)

    def send_data(self):
        return {
            "msg": self.message,
            "who_name": self.who_name,
            "who_number": self.who_number
        }


class Packet6GameBreak(Packet):
    packet_id = 6

    def __init__(self, args, player):
        self.reason = args["reason"]
        self.player = player

    def send_data(self):
        return {
            "reason": self.reason
        }


class Packet7Replay(Packet):
    packet_id = 7

    def __init__(self, args, player):
        self.player = player

    def handle(self):
        if self.player.room is None:
            return
        if not self.player.room.ended:
            return

        self.player.room.wants_replay(self.player)


class Packet8OtherWantsReplay(Packet):
    packet_id = 8

    def __init__(self, args, player):
        self.player = player


class Packet9RoomsList(Packet):
    packet_id = 9

    def __init__(self, args, player):
        self.player = player

    def handle(self):
        Packet.send(self)

    def send_data(self):
        return list(
            {"name": Room.rooms[room].name, "pass": Room.rooms[room].password != ""} for room in Room.rooms if not Room.rooms[room].started
        )


Packet.register_client_packet(Packet0Test)
Packet.register_client_packet(Packet1JoinRoom)
Packet.register_client_packet(Packet2CreateRoom)
Packet.register_client_packet(Packet3GameStarted)
Packet.register_client_packet(Packet4SetField)
Packet.register_client_packet(Packet5ChatMessage)
Packet.register_client_packet(Packet6GameBreak)
Packet.register_client_packet(Packet7Replay)
Packet.register_client_packet(Packet8OtherWantsReplay)
Packet.register_client_packet(Packet9RoomsList)


@asyncio.coroutine
def connection(websocket, path):
    player = Player(websocket)

    data = yield from websocket.recv()

    while data is not None:
        if player.disconnect:
            break
        packet_json = json.loads(data)

        player.last_activity = time.time()
        Packet.handle_client_packet(packet_json, player)

        data = yield from websocket.recv()


    room = player.room
    if room is not None:
        if player.room.other(player) is not None:
            Packet.send(Packet6GameBreak({"reason": "OtherPlayerDisconnected"}, player.room.other(player)))
            player.room.other(player).disconnect = True
            Player.remove(player.room.other(player))
        Room.remove(room)

        for player_id in Player.players:
            Packet.send(Packet9RoomsList({}, Player.players[player_id]))

    Player.remove(player)


@asyncio.coroutine
def logic():
    while True:
        begin = time.time()

        to_delete = []

        room_deleted = False

        for player_id in Player.players:

            player = Player.players[player_id]

            if not player.socket.open:
                if player.room is not None:
                    if player.room.other(player) is not None:
                        to_delete.append(player.room.other(player))

                    Room.remove(player.room)

                to_delete.append(player)

            if player.room is not None and player.room.other(player) is not None and player.last_activity < begin - 360:
                Packet.send(Packet6GameBreak({"reason": "OtherUnactive"}))
                to_delete.append(player.room.other(player))

                Room.remove(player.room)
                room_deleted = True

                Packet.send(Packet6GameBreak({"reason": "UUnactive"}, player))
                to_delete.append(player)

        for player_id in to_delete:
            Player.remove(Player.players[player_id])

        if room_deleted:
            for player_id in Player.players:
                Packet.send(Packet9RoomsList({}, Player.players[player_id]))

        spent_time = time.time() - begin

        yield from asyncio.sleep(1 - spent_time)


srv = websockets.serve(connection, "0.0.0.0", 8181)

asyncio.async(logic())

asyncio.get_event_loop().run_until_complete(srv)
asyncio.get_event_loop().run_forever()
