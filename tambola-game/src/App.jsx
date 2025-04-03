import { useState, useEffect } from "react";
import GameLobby from "./components/GameLobby";

const App = () => {
  const [player, setPlayer] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("http://localhost:3001/")
      .then((res) => res.json())
      .then((data) => setMessage(data.message))
      .catch((err) => console.error("Error fetching data:", err));
  }, []);

  return (
    <div>
      {!player ? (
        <GameLobby onJoin={(name) => setPlayer(name)} />
      ) : (
        <h1 className="text-white text-center mt-10">Welcome {player}!</h1>
      )}
      <p className="text-center text-gray-400">Backend says: {message}</p>
    </div>
  );
};

export default App;
