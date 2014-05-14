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


class Room():
    rooms = {}

    def __init__(self):
        pass


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

        print(1)

        for pl_id in Player.players:
            player = Player.player_by_id(pl_id)
            print(pl_id)
            pck = Packet0Test({"text": "Hello."}, player)
            Packet.send(pck)

        spent_time = time.time() - begin

        yield from asyncio.sleep(1 - spent_time)


srv = websockets.serve(connection, "0.0.0.0", 81)

asyncio.async(logic())

asyncio.get_event_loop().run_until_complete(srv)
asyncio.get_event_loop().run_forever()
