# Tic-Tac-Toe 9x9 with multiplayer

#### Description
This is Tic-Tac-Toe 9x9 game with multiplayer. The client is written in JavaScript using Canvas and Websockets. The server is written in Python using [websockets](https://pypi.python.org/pypi/websockets) module.

#### But what is Tic-Tac-Toe *9x9*?
Imagine that you have a standard Tic-Tac-Toe 3x3 field (let's name it *main field*) and at every cell of this field you have one more standard Tic-Tac-Toe field (let's name them *child fields*). When someone wins in a child field, a corresponding parent cell becomes a property of this player. So the winner is the player who wins in the main field.

####  How does multiplayer work?
1. A client connects to a server.
2. The client gets the list of *rooms*.
3. a) The client can join one of the rooms, so the game in this room will be started.  
   b) Or it can create a new one, then the player will wait for another one who will join this room.
4. The game starts.
5. The game ends. Players of the room can play one more time, or they can leave the room and it will be destroyed.
