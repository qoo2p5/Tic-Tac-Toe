# Tic-Tac-Toe 9x9 with multiplayer

#### Description
This is Tic-Tac-Toe 9x9 game with multiplayer. Its client is written in JavaScript using Canvas and WebSockets. Its server is written in Python using [websockets](https://pypi.python.org/pypi/websockets) module. If you have Python < 3.4 you shall install asyncio module: *pip install asyncio*.

#### But what is Tic-Tac-Toe *9x9*?
Imagine that you have a standart tic-tac-toe 3x3 field (let's name it *main field*) and at every cell of this field you have one more standart tic-tac-toe field (let's name every of them *child field*). When someone wins in a child field a parent cell of it becomes own of this player. So the winner is the player who wins in the main field.

####  How does multiplayer work?
1. A client connects to a server.
2. The client gets the list of *rooms*.
3. a) The client can join one of the rooms, so the game in this room will be started.
   b) Or it can create a new one, then the player will wait for other one who will connect to this room.
4. Game process..
5. Game ended. Players of the room can restore their room and play one more time, or they can quit the room and it'll be destroyed.
