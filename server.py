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

        for x in range(0, 2):
            if self.at(x, 0) == self.at(x, 1) == self.at(x, 2) != 0:
                for y in range(0, 3):
                    how.append((x, y))
                return how

        for y in range(0, 2):
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
    def remove(name):
        del Room.rooms[name]

    def __init__(self, name, password=""):
        self.name = name
        self.first_player = None
        self.second_player = None
        self.fields = [[Field(), Field(), Field()] for i in range(3)]
        self.main_field = Field()
        self.who_goes = 1
        self.started = False
        self.password = password
        Room.rooms[name] = self

    def add_player(self, player):
        if self.first_player is None:
            self.first_player = player
            return 1
        else:
            self.second_player = player
            self.started = True
            return 2

    def other(self, player):
        if player == self.first_player:
            return self.second_player
        else:
            return self.first_player

    def set(self, field_x, field_y, x, y, pl):
        if not self.started:
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
            return [2, win]


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
        send_data = Packet.packetize(packet, packet.send_data())
        print(send_data)
        yield from packet.player.socket.send(send_data)


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


# TODO: implement all packets

class Packet1JoinRoom(Packet):
    packet_id = 1

    def __init__(self, args, player):
        self.room_name = args["room"]
        self.password = args["pass"]
        self.result = ""
        self.player = player

    def handle(self):
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
            "result": self.result
        }


class Packet2CreateRoom(Packet):
    packet_id = 2

    def __init__(self, args, player):
        self.room_name = args["room"]
        self.result = ""
        self.player = player

    def handle(self):
        if Room.by_name(self.room_name) is not None:
            self.result = "RoomNameAlreadyUsed"
        else:
            Room(self.room_name)
            self.result = "Okay"

        Packet.send(self)

    def send_data(self):
        return {
            "result": self.result
        }


class Packet3OtherJoinedRoom(Packet):
    packet_id = 3

    def __init__(self, args, player):
        self.who = args["who"]
        self.room_name = args["room"]
        self.player = player

    def send_data(self):
        return {
            "who": self.who,
            "room": self.room
        }


class Packet4SetField(Packet):
    packet_id = 4

    def __init__(self, args, player):
        self.cell = args["cell"]  # (x, y)
        self.field = args["field"]  # (x, y)
        self.player = player
        self.type = None
        self.data = None

    def handle(self):
        result = self.player.room.set(self.field[0], self.field[1], self.cell[0], self.cell[1], self.player)
        self.type = result[0]

        if self.type == 0:
            return
        elif self.type == 1:
            self.data = (self.field[0], self.field[1], self.cell[0], self.cell[1])
        else:  # type == 2
            self.data = (self.field[0], self.field[1], self.cell[0], self.cell[1], result[1])

        Packet.send(self)

        pck_to_other = Packet4SetField({"cell": self.cell, "field": self.field}, self.player.room.other(self.player))
        pck_to_other.type = self.type
        pck_to_other.data = self.data
        Packet.send(pck_to_other)

    def send_data(self):
        return {
            "type": self.type,
            "data": self.data
        }


class Packet5ChatMessage(Packet):
    def __init__(self, args):
        pass


class Packet6GameEnd(Packet):
    def __init__(self, args):
        pass


class Packet7Replay(Packet):
    def __init__(self, args):
        pass

Packet.register_client_packet(Packet0Test)
Packet.register_client_packet(Packet1JoinRoom)
Packet.register_client_packet(Packet2CreateRoom)
Packet.register_client_packet(Packet3OtherJoinedRoom)
Packet.register_client_packet(Packet4SetField)


@asyncio.coroutine
def connection(websocket, path):
    player = Player(websocket)

    data = yield from websocket.recv()

    while data is not None:
        packet_json = json.loads(data)

        try:
            Packet.handle_client_packet(packet_json, player)

            data = yield from websocket.recv()

        except Exception as e:
            print(str(e))
            # break

    room = player.room
    other_player = player.room.other(player)
    if room is not None and other_player is not None:
        # TODO: send Packet6GameEnd to other room player
        Player.remove(other_player)
        Room.remove(room)

    Player.remove(player)


@asyncio.coroutine
def logic():
    while True:
        begin = time.time()

        # TODO: logic updates here

        spent_time = time.time() - begin

        yield from asyncio.sleep(1 - spent_time)


srv = websockets.serve(connection, "0.0.0.0", 81)

asyncio.async(logic())

asyncio.get_event_loop().run_until_complete(srv)
asyncio.get_event_loop().run_forever()
