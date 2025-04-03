import { useState, useEffect } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

const GameLobby = ({ onJoin }) => {
  const [playerName, setPlayerName] = useState("");
  const [players, setPlayers] = useState([]);

  useEffect(() => {
    socket.on("updatePlayers", (updatedPlayers) => {
      setPlayers(updatedPlayers);
    });

    return () => socket.off("updatePlayers");
  }, []);

  const handleJoin = () => {
    if (playerName) {
      socket.emit("joinGame", playerName);
      onJoin(playerName);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-900 text-white">
      <h1 className="text-3xl font-bold mb-4">Tambola Game</h1>
      <input
        type="text"
        className="px-4 py-2 mb-4 border rounded text-black"
        placeholder="Enter Name"
        value={playerName}
        onChange={(e) => setPlayerName(e.target.value)}
      />
      <button className="px-6 py-2 bg-green-500 rounded text-white" onClick={handleJoin}>
        Join Game
      </button>
      <h2 className="mt-4">Players:</h2>
      <ul>
        {players.map((p, index) => (
          <li key={index}>{p.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default GameLobby;
