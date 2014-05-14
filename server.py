import asyncio
import websockets
import json
import time


class Player():
    players = {}
    next_id = 0

    @staticmethod
    def player_by_id(player_id):
        return Player.players[player_id]

    def __init__(self, ws):
        self.id = Player.next_id
        self.socket = ws
        Player.players[self.id] = self
        Player.next_id += 1


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
            if self.matrix.at(x, 0) == self.matrix.at(x, 1) == self.matrix.at(x, 2):
                for y in range(0, 2):
                    how.append((x, y))
                return how

        for y in range(0, 2):
            if self.matrix.at(0, y) == self.matrix.at(1, y) == self.matrix.at(2, y):
                for x in range(0, 2):
                    how.append((x, y))
                return how

        if self.matrix.at(0, 0) == self.matrix.at(1, 1) == self.matrix.at(2, 2):
            return [(0, 0), (1, 1), (2, 2)]

        if self.matrix.at(2, 0) == self.matrix.at(1, 1) == self.matrix.at(0, 2):
            return [(2, 0), (1, 1), (0, 2)]

        return False


class Room():
    rooms = {}

    def __init__(self):
        self.first_player = None
        self.second_player = None
        self.fields = [[Field(), Field(), Field()] for i in range(3)]
        self.main_field = Field()



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
        yield from packet.player.socket.send(Packet.packetize(packet, packet.send_data()))


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
    def __init__(self, args):
        pass


class Packet2CreateRoom(Packet):
    def __init__(self, args):
        pass


class Packet3OtherJoinedRoom(Packet):
    def __init__(self, args):
        pass


class Packet4SetField(Packet):
    def __init__(self, args):
        pass


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
            break

    del Player.players[player.id]


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
